// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactNode, useMemo } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EN_LABELS } from "@/components/onboarding/labels/en";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { HelpTopic, Tour } from "@/components/onboarding/types";
import { useHelpTopics } from "@/components/onboarding/use-help-topics";
import { useOnboarding } from "@/components/onboarding/use-onboarding";
import { useTour } from "@/components/onboarding/use-tour";
import { useTourAnchor } from "@/components/onboarding/use-tour-anchor";

/**
 * The tour runner, from the outside: what a user sees and clicks.
 *
 * The English table is used on purpose — these assert the engine's behaviour,
 * not Bluz's wording, which `onboarding-gantt-tour` covers.
 */

const TOPICS: ReadonlyArray<HelpTopic> = [
    {
        id: "topic.cut",
        group: "Gantt",
        title: "Cutting is additive",
        body: "It never overwrites.",
        tourId: "demo",
    },
];

function buildTour(overrides: Partial<Tour> = {}): Tour {
    return {
        id: "demo",
        title: "Demo tour",
        autoStart: true,
        steps: [
            { id: "welcome", title: "Step one", body: "First", placement: "center" },
            { id: "anchored", title: "Step two", body: "Second", anchor: "target" },
            {
                id: "ghost",
                title: "Step three",
                body: "Never shown",
                anchor: "absent",
                optional: true,
            },
        ],
        ...overrides,
    };
}

function Harness({
    tour,
    onTourEnd,
    withAnchor = true,
}: {
    tour: Tour;
    onTourEnd?: (tourId: string, reason: string) => void;
    withAnchor?: boolean;
}) {
    return (
        <OnboardingProvider
            labels={EN_LABELS}
            onTourEnd={onTourEnd}
            storageNamespace="test"
        >
            <Screen tour={tour} withAnchor={withAnchor} />
        </OnboardingProvider>
    );
}

function Screen({ tour, withAnchor }: { tour: Tour; withAnchor: boolean }) {
    const memoizedTour = useMemo(() => tour, [tour]);
    useTour(memoizedTour);
    useHelpTopics(TOPICS);
    const { openHelp } = useOnboarding();
    const anchorRef = useTourAnchor<HTMLButtonElement>("target");

    return (
        <div>
            {withAnchor ? <button ref={anchorRef}>Target</button> : null}
            <button onClick={openHelp}>Open help</button>
        </div>
    );
}

const seeStep = async (title: string): Promise<void> => {
    await waitFor(() => expect(screen.getByText(title)).toBeDefined(), {
        timeout: 3000,
    });
};

const clickButton = async (name: string): Promise<void> => {
    await userEvent.click(screen.getByRole("button", { name }));
};

const storedCompletions = (): Record<string, { reason: string; version: number }> =>
    JSON.parse(localStorage.getItem("test:onboarding:completions:v1") ?? "{}");

beforeEach(() => localStorage.clear());
afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("guided tour", () => {
    it("auto-starts on first visit and walks to the end", async () => {
        render(<Harness tour={buildTour()} />);

        await seeStep("Step one");
        // The step with no anchor of its own is one of two showable steps —
        // the third never counts, because its anchor is not on screen.
        expect(screen.getByText("1 of 2")).toBeDefined();

        await clickButton("Next");
        await seeStep("Step two");
        expect(screen.getByText("2 of 2")).toBeDefined();

        await clickButton("Got it");
        await waitFor(() => expect(screen.queryByText("Step two")).toBeNull());
        expect(storedCompletions().demo.reason).toBe("completed");
    });

    it("steps back to the previous step", async () => {
        render(<Harness tour={buildTour()} />);

        await seeStep("Step one");
        await clickButton("Next");
        await seeStep("Step two");

        await clickButton("Back");
        await seeStep("Step one");
    });

    it("runs beforeShow before showing the step", async () => {
        const order: Array<string> = [];
        const tour = buildTour({
            steps: [
                {
                    id: "welcome",
                    title: "Step one",
                    body: "First",
                    placement: "center",
                },
                {
                    id: "prepared",
                    title: "Prepared step",
                    body: "Second",
                    placement: "center",
                    beforeShow: () => void order.push("beforeShow"),
                },
            ],
        });
        render(<Harness tour={tour} />);

        await seeStep("Step one");
        await clickButton("Next");
        await seeStep("Prepared step");
        order.push("shown");

        expect(order).toEqual(["beforeShow", "shown"]);
    });

    it("degrades a required step whose anchor never mounts instead of stalling", async () => {
        const tour = buildTour({
            anchorTimeoutMs: 50,
            steps: [
                {
                    id: "welcome",
                    title: "Step one",
                    body: "First",
                    placement: "center",
                },
                {
                    id: "anchored",
                    title: "Step two",
                    body: "Second",
                    anchor: "target",
                },
            ],
        });
        render(<Harness tour={tour} withAnchor={false} />);

        await seeStep("Step one");
        await clickButton("Next");
        await seeStep("Step two");
    });

    it("records a dismissal, and does not auto-start again", async () => {
        const onTourEnd = vi.fn();
        const tour = buildTour();
        const { unmount } = render(<Harness onTourEnd={onTourEnd} tour={tour} />);

        await seeStep("Step one");
        await clickButton("Skip");
        await waitFor(() => expect(screen.queryByText("Step one")).toBeNull());

        expect(onTourEnd).toHaveBeenCalledWith("demo", "dismissed");
        expect(storedCompletions().demo.reason).toBe("dismissed");

        unmount();
        render(<Harness tour={tour} />);
        // Long enough to cover the auto-start delay and then some.
        await new Promise((resolve) => setTimeout(resolve, 1200));
        expect(screen.queryByText("Step one")).toBeNull();
    });

    it("shows a rewritten tour again once its version is bumped", async () => {
        render(<Harness tour={buildTour()} />);
        await seeStep("Step one");
        await clickButton("Skip");
        await waitFor(() => expect(screen.queryByText("Step one")).toBeNull());
        cleanup();

        render(<Harness tour={buildTour({ version: 2 })} />);
        await seeStep("Step one");
    });

    it("closes on Escape", async () => {
        render(<Harness tour={buildTour()} />);

        await seeStep("Step one");
        await userEvent.keyboard("{Escape}");

        await waitFor(() => expect(screen.queryByText("Step one")).toBeNull());
        expect(storedCompletions().demo.reason).toBe("dismissed");
    });
});

describe("help panel", () => {
    it("lists the contributed topics and replays their tour", async () => {
        render(<Harness tour={buildTour({ autoStart: false })} />);

        await clickButton("Open help");
        await waitFor(() => expect(screen.getByText("Help")).toBeDefined());
        expect(screen.getByText("Cutting is additive")).toBeDefined();
        expect(screen.getByText("Gantt")).toBeDefined();

        await clickButton("Replay the tour");
        await seeStep("Step one");
    });
});
