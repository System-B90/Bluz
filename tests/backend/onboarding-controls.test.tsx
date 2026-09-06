// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactNode, useMemo } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withLabelOverrides } from "@/components/onboarding/labels";
import { EN_LABELS } from "@/components/onboarding/labels/en";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import {
    HelpTopic,
    OnboardingStorage,
    Tour,
} from "@/components/onboarding/types";
import { useHelpTopics } from "@/components/onboarding/use-help-topics";
import { useOnboarding } from "@/components/onboarding/use-onboarding";
import { useTour } from "@/components/onboarding/use-tour";

/**
 * The provider's control surface: what a host app can decide about a tour
 * without touching the runner — when it starts, where "seen" is stored, how it
 * is replayed, and what the help panel shows.
 */

const centredStep = (id: string, title: string) => ({
    id,
    title,
    body: `${title} body`,
    placement: "center" as const,
});

const TOUR: Tour = {
    id: "first",
    title: "First tour",
    autoStart: true,
    steps: [centredStep("a", "Step A")],
};

const OTHER_TOUR: Tour = {
    id: "second",
    title: "Second tour",
    steps: [centredStep("b", "Step B")],
};

function Controls() {
    const { forgetTour, isTourCompleted, openHelp, startTour } = useOnboarding();

    return (
        <div>
            <button onClick={() => startTour("second")}>Start second</button>
            <button onClick={() => forgetTour("first")}>Forget first</button>
            <button onClick={openHelp}>Open help</button>
            <span>{isTourCompleted("first") ? "seen" : "unseen"}</span>
        </div>
    );
}

function Registrar({ tour }: { tour: Tour }) {
    const memoized = useMemo(() => tour, [tour]);
    useTour(memoized);
    return null;
}

function TopicRegistrar({ topics }: { topics: ReadonlyArray<HelpTopic> }) {
    const memoized = useMemo(() => topics, [topics]);
    useHelpTopics(memoized);
    return null;
}

function Harness({
    autoStart,
    children,
    storage,
}: {
    autoStart?: boolean;
    children: ReactNode;
    storage?: OnboardingStorage;
}) {
    return (
        <OnboardingProvider
            autoStart={autoStart}
            labels={EN_LABELS}
            storage={storage}
            storageNamespace="controls"
        >
            {children}
        </OnboardingProvider>
    );
}

const seeStep = async (title: string): Promise<void> => {
    await waitFor(() => expect(screen.getByText(title)).toBeDefined(), {
        timeout: 3000,
    });
};

/** Longer than the auto-start delay, so "did not start" means it never will. */
const settle = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
};

beforeEach(() => localStorage.clear());
afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("provider controls", () => {
    it("honours autoStart={false} and still starts a tour on demand", async () => {
        render(
            <Harness autoStart={false}>
                <Registrar tour={TOUR} />
                <Registrar tour={OTHER_TOUR} />
                <Controls />
            </Harness>,
        );

        await settle();
        expect(screen.queryByText("Step A")).toBeNull();

        await userEvent.click(screen.getByRole("button", { name: "Start second" }));
        await seeStep("Step B");
    });

    it("writes 'seen' through the storage seam instead of localStorage", async () => {
        const store = new Map<string, string>();
        const storage: OnboardingStorage = {
            read: (key) => store.get(key) ?? null,
            write: (key, value) => void store.set(key, value),
        };

        render(
            <Harness storage={storage}>
                <Registrar tour={TOUR} />
            </Harness>,
        );

        await seeStep("Step A");
        await userEvent.click(screen.getByRole("button", { name: "Got it" }));

        await waitFor(() =>
            expect(store.get("controls:onboarding:completions:v1")).toContain(
                "first",
            ),
        );
        expect(localStorage.length).toBe(0);
    });

    it("forgetting a tour lets it auto-start again", async () => {
        render(
            <Harness>
                <Registrar tour={TOUR} />
                <Controls />
            </Harness>,
        );

        await seeStep("Step A");
        await userEvent.click(screen.getByRole("button", { name: "Got it" }));
        await waitFor(() => expect(screen.getByText("seen")).toBeDefined());

        await userEvent.click(screen.getByRole("button", { name: "Forget first" }));
        await waitFor(() => expect(screen.getByText("unseen")).toBeDefined());
        await seeStep("Step A");
    });

    it("stops a running tour when the screen that registered it unmounts", async () => {
        const { rerender } = render(
            <Harness>
                <Registrar tour={TOUR} />
            </Harness>,
        );

        await seeStep("Step A");

        rerender(<Harness>{null}</Harness>);

        await waitFor(() => expect(screen.queryByText("Step A")).toBeNull());
    });

    it("re-words individual strings without restating the table", async () => {
        const labels = withLabelOverrides(EN_LABELS, {
            done: "Understood",
            help: { title: "Guides" },
        });

        render(
            <OnboardingProvider labels={labels} storageNamespace="controls">
                <Registrar tour={TOUR} />
            </OnboardingProvider>,
        );

        await seeStep("Step A");
        expect(screen.getByRole("button", { name: "Understood" })).toBeDefined();
        // Untouched strings keep the base table's wording.
        expect(screen.getByRole("button", { name: "Skip" })).toBeDefined();
        expect(labels.help.title).toBe("Guides");
        expect(labels.help.close).toBe(EN_LABELS.help.close);
    });
});

describe("help panel contents", () => {
    it("groups topics and sorts them by their declared order", async () => {
        const topics: ReadonlyArray<HelpTopic> = [
            { id: "z", group: "Gantt", title: "Zeta", body: "z", order: 2 },
            { id: "a", group: "Gantt", title: "Alpha", body: "a", order: 1 },
            { id: "s", group: "Schedule", title: "Sigma", body: "s" },
        ];

        render(
            <Harness autoStart={false}>
                <TopicRegistrar topics={topics} />
                <Controls />
            </Harness>,
        );

        await userEvent.click(screen.getByRole("button", { name: "Open help" }));
        await waitFor(() => expect(screen.getByText("Gantt")).toBeDefined());

        const panel = screen.getByRole("presentation");
        const rendered = ["Gantt", "Alpha", "Zeta", "Schedule", "Sigma"].map(
            (text) => (panel.textContent ?? "").indexOf(text),
        );

        expect(rendered.every((index) => index >= 0)).toBe(true);
        // Declared order wins inside a group, and each group stays together.
        expect(rendered).toEqual([...rendered].sort((a, b) => a - b));
    });

    it("turns the empty state into a way out rather than a dead end", async () => {
        render(
            <Harness autoStart={false}>
                <Registrar tour={TOUR} />
                <Controls />
            </Harness>,
        );

        await userEvent.click(screen.getByRole("button", { name: "Open help" }));

        await waitFor(() =>
            expect(screen.getByText(EN_LABELS.help.empty)).toBeDefined(),
        );
        expect(screen.getByText(EN_LABELS.help.emptyHint)).toBeDefined();

        // The offered tour is the way out of the empty panel.
        await userEvent.click(screen.getByRole("button", { name: "First tour" }));
        await seeStep("Step A");
    });
});

describe("misuse", () => {
    it("fails with one clear message outside the provider", () => {
        const consoleError = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        expect(() => render(<Controls />)).toThrow(
            /must be used inside an <OnboardingProvider>/,
        );

        consoleError.mockRestore();
    });
});
