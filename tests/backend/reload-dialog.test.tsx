// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Component tests for the two reload-dialog bugs:
 *
 *  1. An unfinished gantt made the reload a dead end — the server has always
 *     accepted `force`, but the dialog never offered it (the cut dialog does).
 *  2. The dialogs stay mounted while closed, so a phase from an earlier
 *     attempt (an error, a finished summary) resurfaced on the next open —
 *     most visibly after a pull-back and re-cut, where it was plainly stale.
 */

const { reload, cut, plan, pullBack, status } = vi.hoisted(() => ({
    cut: vi.fn(),
    // The dialog is plan-then-confirm: it plans first, and commits straight
    // away when the plan raises no questions.
    plan: vi.fn(async () => ({
        ok: true as const,
        plannedEvents: 0,
        overlaps: 0,
        report: {
            moves: [],
            spills: [],
            overflows: [],
            breaks: [],
            constraintProposals: [],
            constraintViolations: [],
            decisions: [],
        },
    })),
    pullBack: vi.fn(),
    reload: vi.fn(),
    status: vi.fn(async () => ({ count: 1, cut: true })),
}));

vi.mock("@/api-client/gantt", () => ({
    ganttApi: { cut: { cut, plan, pullBack, reload, status } },
}));

import { CurriculumCutError } from "@/api-shared/types/gantt/cut";
import { CurriculumReloadError } from "@/api-shared/types/gantt/reload";
import { CutToScheduleAction } from "@/components/gantt/curriculum-fab/action-items/CutToScheduleAction";
import { CutToScheduleDialog } from "@/components/gantt/cut-dialog";
import { PullBackScheduleDialog } from "@/components/gantt/cut-dialog/PullBackScheduleDialog";
import { ReloadScheduleDialog } from "@/components/gantt/cut-dialog/ReloadScheduleDialog";

/**
 * Closes the open dialog and waits for it to leave the tree. While a MUI
 * Dialog is mounted it marks the rest of the app `aria-hidden`, so the action
 * buttons behind it are invisible to role queries until the exit transition
 * finishes.
 */
async function closeDialog(
    user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
    await user.click(screen.getByRole("button", { name: "סגירה" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

const emptyDiff = {
    additions: [],
    conflicts: [],
    removals: [],
    unchanged: 0,
    updates: [],
};

const okResult = {
    addedEvents: 1,
    applied: true,
    createdCourses: [],
    diff: emptyDiff,
    removedEvents: 0,
    skippedConflicts: 0,
    updatedEvents: 0,
};

function unfinishedGanttError(): CurriculumReloadError {
    return new CurriculumReloadError({
        code: "invalid-plan",
        errors: [
            { eventId: "g2", title: "לא משובץ", type: "unmapped-event" },
        ],
        message: "תוכנית הגזירה אינה תקינה",
    });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("ReloadScheduleDialog — unfinished gantt", () => {
    it("offers to force past an unfinished gantt instead of dead-ending", async () => {
        const user = userEvent.setup();
        reload.mockRejectedValueOnce(unfinishedGanttError());

        render(
            <ReloadScheduleDialog
                curriculumId={"c1" as never}
                onClose={vi.fn()}
                open
            />,
        );

        await user.click(screen.getByRole("button", { name: "עדכון" }));

        // The offending event is named, and forcing is gated behind an
        // explicit acknowledgement.
        expect(await screen.findByText(/לא משובץ/)).toBeTruthy();
        const forceButton = screen.getByRole("button", {
            name: "עדכון בכל זאת",
        });
        expect(forceButton.hasAttribute("disabled")).toBe(true);

        await user.click(screen.getByRole("checkbox"));
        expect(forceButton.hasAttribute("disabled")).toBe(false);

        reload.mockResolvedValueOnce(okResult);
        await user.click(forceButton);

        await waitFor(() =>
            expect(reload).toHaveBeenLastCalledWith("c1", {
                force: true,
                overrideEventIds: [],
            }),
        );
    });

    it("does not force on the first attempt", async () => {
        const user = userEvent.setup();
        reload.mockResolvedValueOnce(okResult);

        render(
            <ReloadScheduleDialog
                curriculumId={"c1" as never}
                onClose={vi.fn()}
                open
            />,
        );
        await user.click(screen.getByRole("button", { name: "עדכון" }));

        await waitFor(() =>
            expect(reload).toHaveBeenCalledWith("c1", {
                force: false,
                overrideEventIds: [],
            }),
        );
    });

    it("treats a non-forceable rejection as terminal", async () => {
        const user = userEvent.setup();
        reload.mockRejectedValueOnce(
            new CurriculumReloadError({
                code: "invalid-plan",
                errors: [{ type: "missing-start-date" }],
                message: "תוכנית הגזירה אינה תקינה",
            }),
        );

        render(
            <ReloadScheduleDialog
                curriculumId={"c1" as never}
                onClose={vi.fn()}
                open
            />,
        );
        await user.click(screen.getByRole("button", { name: "עדכון" }));

        expect(
            await screen.findByRole("button", { name: "סגירה" }),
        ).toBeTruthy();
        // A missing start date leaves nothing datable — forcing is not offered.
        expect(
            screen.queryByRole("button", { name: "עדכון בכל זאת" }),
        ).toBeNull();
    });

    it("keeps a state rejection (never cut) terminal too", async () => {
        const user = userEvent.setup();
        reload.mockRejectedValueOnce(
            new CurriculumReloadError({
                code: "not-cut",
                message: 'הגאנט טרם נגזר ללו"ז',
            }),
        );

        render(
            <ReloadScheduleDialog
                curriculumId={"c1" as never}
                onClose={vi.fn()}
                open
            />,
        );
        await user.click(screen.getByRole("button", { name: "עדכון" }));

        expect(await screen.findByText(/טרם נגזר/)).toBeTruthy();
        expect(
            screen.queryByRole("button", { name: "עדכון בכל זאת" }),
        ).toBeNull();
    });
});

describe("dialogs — stale state across opens", () => {
    const curriculum = {
        id: "c1",
        isDraft: false,
        title: "מסלול",
    } as never;

    /**
     * A dialog is not always closed through its own close button: the parent
     * simply flips `open` when the user switches actions, and the component
     * stays mounted so its exit animation can play. That path is what left a
     * previous attempt's phase on screen.
     */
    it("shows a clean confirm when the parent reopens the reload dialog", async () => {
        const user = userEvent.setup();
        reload.mockRejectedValueOnce(
            new CurriculumReloadError({
                code: "not-cut",
                message: "שגיאה קודמת",
            }),
        );

        const props = {
            curriculumId: "c1" as never,
            onClose: vi.fn(),
        };
        const { rerender } = render(<ReloadScheduleDialog {...props} open />);

        await user.click(screen.getByRole("button", { name: "עדכון" }));
        expect(await screen.findByText("שגיאה קודמת")).toBeTruthy();

        // Closed by the parent, then reopened — no handleClose in between.
        rerender(<ReloadScheduleDialog {...props} open={false} />);
        rerender(<ReloadScheduleDialog {...props} open />);

        expect(screen.queryByText("שגיאה קודמת")).toBeNull();
        expect(screen.getByRole("button", { name: "עדכון" })).toBeTruthy();
    });

    it("drops an acknowledged force when the reload dialog reopens", async () => {
        const user = userEvent.setup();
        reload.mockRejectedValueOnce(unfinishedGanttError());

        const props = {
            curriculumId: "c1" as never,
            onClose: vi.fn(),
        };
        const { rerender } = render(<ReloadScheduleDialog {...props} open />);

        await user.click(screen.getByRole("button", { name: "עדכון" }));
        await user.click(await screen.findByRole("checkbox"));

        rerender(<ReloadScheduleDialog {...props} open={false} />);
        rerender(<ReloadScheduleDialog {...props} open />);

        // Back to the plain confirmation — the risk must be re-acknowledged.
        expect(screen.queryByRole("checkbox")).toBeNull();
        expect(screen.getByRole("button", { name: "עדכון" })).toBeTruthy();
    });

    it("shows a clean confirm when the parent reopens the cut dialog", async () => {
        const user = userEvent.setup();
        cut.mockRejectedValueOnce(
            new CurriculumCutError({
                code: "already-cut",
                count: 4,
                message: "כבר נגזר",
            }),
        );

        const props = {
            curriculumId: "c1" as never,
            onClose: vi.fn(),
        };
        const { rerender } = render(<CutToScheduleDialog {...props} open />);

        await user.click(screen.getByRole("button", { name: "גזירה" }));
        expect(await screen.findByText(/כבר נגזר/)).toBeTruthy();

        // After a pull-back the curriculum is cuttable again, and the parent
        // reopens this same dialog — the "already-cut" error is now a lie.
        rerender(<CutToScheduleDialog {...props} open={false} />);
        rerender(<CutToScheduleDialog {...props} open />);

        expect(screen.queryByText(/כבר נגזר/)).toBeNull();
        expect(screen.getByRole("button", { name: "גזירה" })).toBeTruthy();
    });

    it("shows a clean confirm when the parent reopens the pull-back dialog", async () => {
        const user = userEvent.setup();
        pullBack.mockResolvedValueOnce({ removedEvents: 3 });

        const props = {
            curriculumId: "c1" as never,
            onClose: vi.fn(),
        };
        const { rerender } = render(<PullBackScheduleDialog {...props} open />);

        await user.click(screen.getByRole("button", { name: "משיכה חזרה" }));
        expect(await screen.findByText(/3 אירועים נמחקו/)).toBeTruthy();

        rerender(<PullBackScheduleDialog {...props} open={false} />);
        rerender(<PullBackScheduleDialog {...props} open />);

        expect(screen.queryByText(/3 אירועים נמחקו/)).toBeNull();
        expect(
            screen.getByRole("button", { name: "משיכה חזרה" }),
        ).toBeTruthy();
    });

    it("still resets when the dialog is closed through its own button", async () => {
        const user = userEvent.setup();
        render(
            <CutToScheduleAction
                onProcessingChange={vi.fn()}
                sourceCurriculum={curriculum}
            />,
        );

        await user.click(
            await screen.findByRole("button", { name: 'עדכון הלו"ז לפי הגאנט' }),
        );
        reload.mockRejectedValueOnce(
            new CurriculumReloadError({
                code: "not-cut",
                message: "שגיאה קודמת",
            }),
        );
        await user.click(screen.getByRole("button", { name: "עדכון" }));
        expect(await screen.findByText("שגיאה קודמת")).toBeTruthy();
        await closeDialog(user);

        await user.click(
            screen.getByRole("button", { name: 'עדכון הלו"ז לפי הגאנט' }),
        );

        expect(screen.queryByText("שגיאה קודמת")).toBeNull();
        expect(screen.getByRole("button", { name: "עדכון" })).toBeTruthy();
    });
});
