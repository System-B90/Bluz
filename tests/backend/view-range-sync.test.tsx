// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { useState } from "react";
import { View, Views } from "react-big-calendar";
import { afterEach, describe, expect, it } from "vitest";

import { useViewRangeSync } from "@/components/schedule/calendar/calendar/use-view-range-sync";
import { getRangeForView } from "@/components/schedule/calendar/utils";

/**
 * Schedule week flicker: back from the gantt, the view started at today while
 * the provider still held the last viewed week, and the two sync effects
 * undid each other every render.
 */

/** The hook plus a stand-in for CalendarProvider's range state, counting renders. */
function setup(initialProviderStart: Date | undefined, view: View = Views.WEEK) {
    let renders = 0;
    const hook = renderHook(() => {
        // A regression of the ping-pong would otherwise hang the run.
        if (++renders > 50) throw new Error("render loop: view and provider keep resetting each other");
        const [ startDate, setStartDate ] = useState<Date | undefined>(initialProviderStart);
        const [ endDate, setEndDate ] = useState<Date | undefined>(undefined);
        const [ currentDate, setCurrentDate ] = useViewRangeSync({ view, startDate, setStartDate, setEndDate });
        return { currentDate, setCurrentDate, startDate, endDate, setStartDate };
    });
    return { ...hook, renders: () => renders };
}

const weekStart = (date: Date) => getRangeForView(date, Views.WEEK).start.getTime();

afterEach(cleanup);

describe("useViewRangeSync", () => {
    it("remounting with a remembered week settles on it instead of flickering", () => {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 14);
        const { result, renders } = setup(getRangeForView(lastWeek, Views.WEEK).start);

        // A ping-pong would re-render until React bails out; a settled sync
        // takes a couple of renders.
        expect(renders()).toBeLessThan(6);
        expect(weekStart(result.current.currentDate)).toBe(weekStart(lastWeek));
        expect(result.current.startDate?.getTime()).toBe(weekStart(lastWeek));

        const settled = renders();
        act(() => undefined);
        expect(renders()).toBe(settled);
    });

    it("a first visit with no remembered range opens on today", () => {
        const { result } = setup(undefined);
        expect(weekStart(result.current.currentDate)).toBe(weekStart(new Date()));
        expect(result.current.startDate?.getTime()).toBe(weekStart(new Date()));
    });

    it("navigating the view pushes its range and is not bounced back", () => {
        const { result } = setup(undefined);
        const next = new Date();
        next.setDate(next.getDate() + 7);
        act(() => result.current.setCurrentDate(next));
        expect(weekStart(result.current.currentDate)).toBe(weekStart(next));
        expect(result.current.startDate?.getTime()).toBe(weekStart(next));
    });

    it("an outside range change (snapshot restore) moves the view", () => {
        const { result } = setup(undefined);
        const restored = new Date(2026, 0, 14);
        act(() => result.current.setStartDate(restored));
        expect(weekStart(result.current.currentDate)).toBe(weekStart(restored));
    });
});
