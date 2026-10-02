// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    dismissInsights,
    INSIGHTS_DISMISS_KEY,
    INSIGHTS_DISMISS_MS,
    readInsightsDismissedUntil,
} from "@/components/gantt/curriculum-view/components/insights/dismiss";

vi.mock("@/components/gantt/curriculum-view/components/insights/use-insights", () => ({
    useInsights: () => [
        { id: "a", category: "fun", severity: "info", title: "תובנה א", body: "גוף" },
    ],
}));

const { InsightsCard } = await import("@/components/gantt/curriculum-view/components/insights/InsightsCard");

describe("insights dismiss storage (#854)", () => {
    beforeEach(() => sessionStorage.clear());

    it("is not dismissed by default", () => {
        expect(readInsightsDismissedUntil()).toBeNull();
    });

    it("hides for one hour, then expires", () => {
        const until = dismissInsights(1_000);
        expect(until).toBe(1_000 + INSIGHTS_DISMISS_MS);
        expect(readInsightsDismissedUntil(1_000 + INSIGHTS_DISMISS_MS - 1)).toBe(until);
        expect(readInsightsDismissedUntil(1_000 + INSIGHTS_DISMISS_MS)).toBeNull();
    });

    it("ignores garbage values", () => {
        sessionStorage.setItem(INSIGHTS_DISMISS_KEY, "nope");
        expect(readInsightsDismissedUntil()).toBeNull();
    });

    it("uses sessionStorage only, never localStorage", () => {
        localStorage.clear();
        dismissInsights();
        expect(localStorage.length).toBe(0);
        expect(sessionStorage.getItem(INSIGHTS_DISMISS_KEY)).not.toBeNull();
    });
});

describe("InsightsCard dismiss button (#854)", () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.useFakeTimers();
    });
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    const curriculum = { id: 1 } as never;

    it("hides the card on dismiss and brings it back after an hour", () => {
        render(<InsightsCard curriculum={ curriculum } />);
        expect(screen.getByText("תובנה א")).toBeTruthy();

        fireEvent.click(screen.getByLabelText("הסתרת התובנות"));
        expect(screen.queryByText("תובנה א")).toBeNull();

        act(() => vi.advanceTimersByTime(INSIGHTS_DISMISS_MS + 1));
        expect(screen.getByText("תובנה א")).toBeTruthy();
    });

    it("stays hidden on remount within the hour", () => {
        dismissInsights();
        render(<InsightsCard curriculum={ curriculum } />);
        expect(screen.queryByText("תובנה א")).toBeNull();
    });
});
