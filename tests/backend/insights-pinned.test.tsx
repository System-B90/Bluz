// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Insights card (#851): no auto-rotation by default, warnings pinned rather
 * than rotated away, trivia opt-in, and no empty slides.
 */

const { deck } = vi.hoisted(() => ({
    deck: [
        { id: "w", category: "schedule", severity: "warning", title: "13 מופעים עוד לא שובצו", body: "יש לשבץ" },
        { id: "a", category: "content", severity: "info", title: "תובנה א", body: "גוף א" },
        { id: "b", category: "content", severity: "info", title: "תובנה ב", body: "גוף ב" },
        { id: "f", category: "fun", severity: "fun", title: "המילה האהובה", body: "יום" },
    ],
}));

vi.mock("@/components/gantt/curriculum-view/components/insights/use-insights", () => ({
    useInsights: () => deck,
}));

const { InsightsCard } = await import("@/components/gantt/curriculum-view/components/insights/InsightsCard");
const { partitionInsights } = await import("@/components/gantt/curriculum-view/components/insights/generators");
const { insightsAutoRotate, insightsShowFun } = await import(
    "@/components/gantt/curriculum-view/components/insights/preferences"
);

const curriculum = { id: 1 } as never;

beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    insightsAutoRotate.set(false);
    insightsShowFun.set(false);
});

describe("partitionInsights (#851)", () => {
    it("pins warnings and leaves trivia out unless asked", () => {
        const { pinned, deck: rotating } = partitionInsights(deck as never, { includeFun: false });
        expect(pinned.map((i) => i.id)).toEqual([ "w" ]);
        expect(rotating.map((i) => i.id)).toEqual([ "a", "b" ]);
        expect(partitionInsights(deck as never, { includeFun: true }).deck.map((i) => i.id)).toEqual([ "a", "b", "f" ]);
    });
});

describe("InsightsCard (#851)", () => {
    it("keeps the warning pinned and does not rotate by default", () => {
        render(<InsightsCard curriculum={ curriculum } />);
        expect(screen.getByTestId("insights-pinned").textContent).toContain("13 מופעים עוד לא שובצו");
        expect(screen.getByText("1/2")).toBeTruthy();

        act(() => { vi.advanceTimersByTime(60_000); });
        expect(screen.getByText("1/2")).toBeTruthy();
        expect(screen.queryByText("המילה האהובה")).toBeNull();
    });

    it("rotates once the viewer turns auto-rotation on", () => {
        render(<InsightsCard curriculum={ curriculum } />);
        fireEvent.click(screen.getByRole("button", { name: "החלפה אוטומטית" }));
        act(() => { vi.advanceTimersByTime(10_000); });
        expect(screen.getByText("2/2")).toBeTruthy();
        expect(screen.getByTestId("insights-pinned")).toBeTruthy();
    });

    it("shows trivia only when opted in", () => {
        render(<InsightsCard curriculum={ curriculum } />);
        fireEvent.click(screen.getByRole("button", { name: "תובנות משעשעות" }));
        expect(screen.getByText("1/3")).toBeTruthy();
    });
});
