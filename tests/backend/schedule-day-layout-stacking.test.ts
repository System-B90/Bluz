import { describe, expect, it } from "vitest";

import { splitAwareDayLayout } from "@/components/schedule/calendar/split/segment-layout";

/**
 * The schedule's day layout against react-big-calendar's real `overlap`
 * algorithm: back-to-back events stack at full width, any overlap of more
 * than a minute puts them side by side.
 */
const day = new Date("2026-10-08T00:00:00Z");
const at = (hhmm: string) => {
    const [ h, m ] = hhmm.split(":").map(Number);
    return new Date(+day + (h * 60 + m) * 60_000);
};
const minutes = (date: Date) => (+date - +day) / 60_000;

/** Linear slot metrics over the whole day, as react-big-calendar shapes them. */
const slotMetrics = {
    getRange: (start: Date, end: Date) => ({
        start: minutes(start),
        end: minutes(end),
        startDate: start,
        endDate: end,
        top: (minutes(start) / 1440) * 100,
        height: ((minutes(end) - minutes(start)) / 1440) * 100,
    }),
};
const accessors = {
    start: (e: { start: Date }) => e.start,
    end: (e: { end: Date }) => e.end,
};
const segment = (id: string, start: string, end: string) => ({
    key: `${id}#0`,
    event: { id },
    index: 0,
    count: 1,
    start: at(start),
    end: at(end),
});

function widths(...events: Array<ReturnType<typeof segment>>) {
    return splitAwareDayLayout({
        events,
        // What react-big-calendar passes for step 5 × 12 timeslots.
        minimumStartDifference: 30,
        slotMetrics,
        accessors,
    } as never).map((entry) => Math.round(entry.style.width));
}

describe("schedule day layout: stacking vs side by side", () => {
    it("stacks back-to-back events at full width (A ends 9:15, B starts 9:15)", () => {
        expect(widths(segment("a", "09:00", "09:15"), segment("b", "09:15", "10:00"))).toEqual([ 100, 100 ]);
    });

    it("stacks events overlapping by at most a minute", () => {
        expect(widths(segment("a", "09:00", "09:16"), segment("b", "09:15", "10:00"))).toEqual([ 100, 100 ]);
    });

    it("puts events overlapping by more than a minute side by side", () => {
        const [ a, b ] = widths(segment("a", "09:00", "09:17"), segment("b", "09:15", "10:00"));
        expect(a).toBeLessThan(100);
        expect(b).toBeLessThan(100);
    });
});
