// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
    DaySelectionProvider,
    useDaySelection,
} from "@/components/gantt/curriculum-view/tabs/weeks-tab/DaySelectionContext";

/**
 * Shift-selecting day cells for a bulk hours edit (#476). The order the range
 * is defined over is the grid's calendar order, so a range may cross weeks.
 */

// Two weeks of three days each, in calendar order.
const ORDER = ["w1d1", "w1d2", "w1d3", "w2d1", "w2d2", "w2d3"];

function renderSelection(orderedDayIds: Array<string> = ORDER) {
    return renderHook(() => useDaySelection(), {
        wrapper: ({ children }) => (
            <DaySelectionProvider orderedDayIds={orderedDayIds}>
                {children}
            </DaySelectionProvider>
        ),
    });
}

afterEach(cleanup);

describe("day cell selection", () => {
    it("anchors on the first shift-click", () => {
        const { result } = renderSelection();
        act(() => result.current.extendTo("w1d2"));
        expect([...result.current.selectedDayIds]).toEqual(["w1d2"]);
    });

    it("extends across weeks to the second shift-click", () => {
        const { result } = renderSelection();
        act(() => result.current.extendTo("w1d3"));
        act(() => result.current.extendTo("w2d2"));
        expect([...result.current.selectedDayIds].sort()).toEqual([
            "w1d3",
            "w2d1",
            "w2d2",
        ]);
    });

    it("extends backwards just as well", () => {
        const { result } = renderSelection();
        act(() => result.current.extendTo("w2d1"));
        act(() => result.current.extendTo("w1d2"));
        expect([...result.current.selectedDayIds].sort()).toEqual([
            "w1d2",
            "w1d3",
            "w2d1",
        ]);
    });

    it("re-clicking the anchor clears the selection", () => {
        const { result } = renderSelection();
        act(() => result.current.extendTo("w1d1"));
        act(() => result.current.extendTo("w1d1"));
        expect(result.current.selectedDayIds.size).toBe(0);
    });

    it("clear() empties the selection", () => {
        const { result } = renderSelection();
        act(() => result.current.extendTo("w1d1"));
        act(() => result.current.extendTo("w2d3"));
        act(() => result.current.clear());
        expect(result.current.selectedDayIds.size).toBe(0);
    });
});
