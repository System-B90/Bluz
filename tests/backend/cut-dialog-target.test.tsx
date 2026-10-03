// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The cut dialog resolves its target iteration before "גזירה" is pressed (#838):
 * no linked iteration → the button is disabled with a reason; a linked one →
 * the dialog says how many events land in which iteration.
 */

const listIterations = vi.fn();
const plan = vi.fn();

vi.mock("@/api-client/iterations", () => ({ apiListIterations: () => listIterations() }));
vi.mock("@/api-client/gantt", () => ({
    ganttApi: { cut: { plan: (...args: Array<unknown>) => plan(...args), cut: vi.fn() } },
}));

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { CutToScheduleDialog } from "@/components/gantt/cut-dialog";
import { describeCutTarget, findLinkedIteration, isCutBlocked } from "@/components/gantt/cut-dialog/cut-target";
import { Iteration } from "@/api-shared/types/iteration";

const CID = "c1" as GanttCurriculumId;

function iteration(partial: Partial<Iteration>): Iteration {
    return {
        id: "2026a",
        label: "מחזור 2026 א'",
        dbName: "bluz",
        startDate: "2026-01-01",
        endDate: null,
        isCurrent: true,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        ...partial,
    } as Iteration;
}

function renderDialog() {
    render(<CutToScheduleDialog curriculumId={CID} onClose={() => {}} open />);
    return screen.getByRole("button", { name: "גזירה" });
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("cut-target helpers", () => {
    it("finds only the iteration linked to this curriculum", () => {
        const linked = iteration({ id: "b" as Iteration["id"], ganttCurriculumId: CID });
        expect(findLinkedIteration([ iteration({ ganttCurriculumId: "other" }), linked ], CID)).toBe(linked);
        expect(findLinkedIteration([ iteration({}) ], CID)).toBeUndefined();
    });

    it("blocks while loading and when unlinked, never when linked or unknown", () => {
        expect(isCutBlocked({ status: "loading" })).toBe(true);
        expect(isCutBlocked({ status: "unlinked" })).toBe(true);
        expect(isCutBlocked({ status: "unknown" })).toBe(false);
        expect(isCutBlocked({ status: "linked", iterationLabel: "x", plannedEvents: 3 })).toBe(false);
    });

    it("names the count and the iteration", () => {
        expect(describeCutTarget({ status: "linked", iterationLabel: "א", plannedEvents: 12 })).toBe(
            'ייווצרו 12 אירועים במחזור "א".',
        );
        expect(describeCutTarget({ status: "linked", iterationLabel: "א", plannedEvents: null })).toContain('"א"');
    });
});

describe("CutToScheduleDialog target (#838)", () => {
    it("disables גזירה with a reason when no iteration is linked", async () => {
        listIterations.mockResolvedValue([ iteration({}) ]);
        const button = renderDialog();
        await screen.findByTestId("cut-no-iteration");
        expect(button).toHaveProperty("disabled", true);
        expect(screen.getByTestId("cut-no-iteration").textContent).toContain("יש לקשר מחזור לפני גזירה");
        expect(plan).not.toHaveBeenCalled();
    });

    it("enables גזירה and states the planned count when linked", async () => {
        listIterations.mockResolvedValue([ iteration({ ganttCurriculumId: CID }) ]);
        plan.mockResolvedValue({ ok: true, plannedEvents: 42, overlaps: 0, report: { decisions: [] } });
        const button = renderDialog();
        await waitFor(() =>
            expect(screen.getByTestId("cut-target-summary").textContent).toBe(
                "ייווצרו 42 אירועים במחזור \"מחזור 2026 א'\".",
            ),
        );
        expect(button).toHaveProperty("disabled", false);
    });

    it("stays usable when the iteration list cannot be loaded", async () => {
        listIterations.mockRejectedValue(new Error("down"));
        const button = renderDialog();
        await waitFor(() => expect(button).toHaveProperty("disabled", false));
    });

    it("no longer claims a re-cut needs deleting events by hand", () => {
        listIterations.mockReturnValue(new Promise(() => undefined));
        renderDialog();
        expect(document.body.textContent).toContain("משיכה חזרה");
        expect(document.body.textContent).not.toContain("מחייבת מחיקת");
    });
});
