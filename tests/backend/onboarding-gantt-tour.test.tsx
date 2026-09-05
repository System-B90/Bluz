// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dispatch, SetStateAction } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_ANCHORS, GANTT_ANCHORS } from "@/components/app-onboarding/anchors";
import { GanttOnboarding } from "@/components/app-onboarding/gantt/GanttOnboarding";
import { GANTT_TAB_INDEX } from "@/components/app-onboarding/gantt/tabs";
import { ONBOARDING_LABELS } from "@/components/app-onboarding/labels";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { useOnboarding } from "@/components/onboarding/use-onboarding";
import { useTourAnchor } from "@/components/onboarding/use-tour-anchor";

/**
 * Bluz's gantt tour (#659). What matters here is not the wording of every step
 * but the two things the issue asked for: the tour takes the user through the
 * tabs by itself, and it says out loud that cutting cannot overwrite the
 * schedule.
 */

function Anchor({ id }: { id: string }) {
    return <div ref={useTourAnchor<HTMLDivElement>(id)}>{id}</div>;
}

const ALL_ANCHORS: ReadonlyArray<string> = [
    APP_ANCHORS.help,
    GANTT_ANCHORS.curriculumFab,
    GANTT_ANCHORS.search,
    GANTT_ANCHORS.sidebar,
    GANTT_ANCHORS.tabs,
];

function GanttScreen({
    anchors,
    setSelectedTabIndex,
}: {
    anchors: ReadonlyArray<string>;
    setSelectedTabIndex: Dispatch<SetStateAction<number>>;
}) {
    const { openHelp } = useOnboarding();

    return (
        <div>
            {anchors.map((id) => (
                <Anchor id={id} key={id} />
            ))}

            <button onClick={openHelp}>עזרה</button>

            <GanttOnboarding setSelectedTabIndex={setSelectedTabIndex} />
        </div>
    );
}

function renderGanttScreen(anchors: ReadonlyArray<string> = ALL_ANCHORS) {
    const setSelectedTabIndex = vi.fn();
    render(
        <OnboardingProvider
            labels={ONBOARDING_LABELS}
            storageNamespace="bluz-test"
        >
            <GanttScreen
                anchors={anchors}
                setSelectedTabIndex={setSelectedTabIndex}
            />
        </OnboardingProvider>,
    );
    return { setSelectedTabIndex };
}

const seeStep = async (title: string | RegExp): Promise<void> => {
    await waitFor(() => expect(screen.getByText(title)).toBeDefined(), {
        timeout: 3000,
    });
};

const currentStepText = (): string =>
    screen.getByRole("dialog").textContent ?? "";

/**
 * Advances until the step with this title is showing.
 *
 * Waits for the card to actually change between clicks: steps commit
 * asynchronously (`beforeShow` runs and the anchor is waited for), and a click
 * that lands mid-transition is a no-op by design.
 */
const advanceTo = async (title: RegExp): Promise<void> => {
    for (let clicks = 0; clicks < 12; clicks += 1) {
        const shown = currentStepText();
        if (title.test(shown)) return;

        await userEvent.click(screen.getByRole("button", { name: "הבא" }));
        await waitFor(() => expect(currentStepText()).not.toBe(shown), {
            timeout: 3000,
        });
    }
    throw new Error(`never reached the step titled ${title}`);
};

beforeEach(() => localStorage.clear());
afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("gantt onboarding tour", () => {
    it("auto-starts for a first-time planner", async () => {
        renderGanttScreen();

        await seeStep("ברוכים הבאים לגאנט");
    });

    it("drives the tab strip so each step is about what is on screen", async () => {
        const { setSelectedTabIndex } = renderGanttScreen();

        await seeStep("ברוכים הבאים לגאנט");
        await advanceTo(/מה באמת קורה/);

        // Content, then weeks, then the read-only preview — in that order.
        expect(setSelectedTabIndex.mock.calls.map(([index]) => index)).toEqual([
            GANTT_TAB_INDEX.syllabuses,
            GANTT_TAB_INDEX.weeks,
            GANTT_TAB_INDEX.cutPreview,
        ]);
    });

    it("tells the user the cut cannot overwrite the schedule", async () => {
        renderGanttScreen();

        await seeStep("ברוכים הבאים לגאנט");
        await advanceTo(/מה באמת קורה/);

        expect(screen.getByText(/לא מוחקת ולא דורסת/)).toBeDefined();
        expect(screen.getByText(/משיכה חזרה/)).toBeDefined();
    });

    it("speaks in Bluz's voice, not the package's default wording", async () => {
        renderGanttScreen();

        await seeStep("ברוכים הבאים לגאנט");

        expect(screen.getByRole("button", { name: "אולי אחר כך" })).toBeDefined();
        expect(screen.queryByRole("button", { name: "דילוג" })).toBeNull();
    });

    it("skips the steps whose UI is not on this screen", async () => {
        // A planner who never opened the syllabuses tab has no search field and
        // no hours sidebar; those steps drop out instead of pointing at nothing.
        renderGanttScreen([GANTT_ANCHORS.curriculumFab, GANTT_ANCHORS.tabs]);

        await seeStep("ברוכים הבאים לגאנט");
        await advanceTo(/מה באמת קורה/);

        expect(screen.queryByText("חיפוש בתוך הגאנט")).toBeNull();
        expect(screen.queryByText("שבועות ומכסת שעות")).toBeNull();
    });

    it("leaves the same explanations behind in the help panel", async () => {
        renderGanttScreen();

        await seeStep("ברוכים הבאים לגאנט");
        await userEvent.keyboard("{Escape}");
        await waitFor(() =>
            expect(screen.queryByText("ברוכים הבאים לגאנט")).toBeNull(),
        );

        await userEvent.click(screen.getByRole("button", { name: "עזרה" }));

        await waitFor(() => expect(screen.getByText("מסך הגאנט")).toBeDefined());
        expect(screen.getByText("מה זה בכלל גאנט?")).toBeDefined();
        expect(screen.getByText(/היא לא מוחקת ולא דורסת/)).toBeDefined();
    });
});
