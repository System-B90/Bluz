import { describe, expect, it } from "vitest";

import {
    getFirstRequiredRecurrenceWeekIdx,
    getRecurrenceOccurrenceDayIds,
    isDayInRecurrenceWindow,
    isRecurrenceSatisfied,
} from "@/api-shared/gantt/recurrence";
import { EventRecurrence, GanttDayIndex } from "@/api-shared/types/gantt/models";

/**
 * #468: a recurring event's echo used to be pinned to wherever the event was
 * mapped and to run to the end of the timeline. It now honours an optional
 * start/end date window, either bound of which may be left open.
 */

// Three 7-day weeks starting Sunday 2026-06-07: d0..d20.
const linearDays = Array.from({ length: 21 }, (_, i) => `d${i}`);
const weeks = [0, 1, 2].map((w) => ({
    days: linearDays.slice(w * 7, w * 7 + 7),
}));

const dayIndexOf = (dayId: string): GanttDayIndex | undefined => {
    const i = linearDays.indexOf(dayId);
    return i === -1 ? undefined : ((i % 7) as GanttDayIndex);
};

const dateOf = (dayId: string): string | undefined => {
    const i = linearDays.indexOf(dayId);
    if (i === -1) return undefined;
    const date = new Date(Date.UTC(2026, 5, 7 + i));
    return date.toISOString().slice(0, 10);
};

describe("isDayInRecurrenceWindow (#468)", () => {
    it("lets everything through when both bounds are open", () => {
        expect(isDayInRecurrenceWindow("d5", { dateOf })).toBe(true);
    });

    it("rejects days before the start bound", () => {
        // d7 is 2026-06-14.
        expect(
            isDayInRecurrenceWindow("d6", {
                recurrenceStartDate: "2026-06-14",
                dateOf,
            }),
        ).toBe(false);
        expect(
            isDayInRecurrenceWindow("d7", {
                recurrenceStartDate: "2026-06-14",
                dateOf,
            }),
        ).toBe(true);
    });

    it("rejects days after the end bound, inclusive of the bound itself", () => {
        expect(
            isDayInRecurrenceWindow("d7", {
                recurrenceEndDate: "2026-06-14",
                dateOf,
            }),
        ).toBe(true);
        expect(
            isDayInRecurrenceWindow("d8", {
                recurrenceEndDate: "2026-06-14",
                dateOf,
            }),
        ).toBe(false);
    });

    it("lets a day through when its date cannot be resolved", () => {
        // A dateless curriculum must not silently lose every occurrence.
        expect(
            isDayInRecurrenceWindow("d3", {
                recurrenceStartDate: "2026-06-14",
                dateOf: () => undefined,
            }),
        ).toBe(true);
    });
});

describe("getRecurrenceOccurrenceDayIds with a window (#468)", () => {
    it("is unchanged when no window is configured", () => {
        const ids = getRecurrenceOccurrenceDayIds({
            recurrence: EventRecurrence.Weekly,
            startDayId: "d0",
            linearDays,
            dayIndexOf,
            dateOf,
        });
        expect([...ids].sort()).toEqual(["d14", "d7"].sort());
    });

    it("drops echoes before the recurrence start date", () => {
        const ids = getRecurrenceOccurrenceDayIds({
            recurrence: EventRecurrence.Weekly,
            startDayId: "d0",
            linearDays,
            dayIndexOf,
            dateOf,
            // 2026-06-21 is d14's date, so d7 (06-14) falls outside.
            recurrenceStartDate: "2026-06-21",
        });
        expect([...ids]).toEqual(["d14"]);
    });

    it("drops echoes after the recurrence end date", () => {
        const ids = getRecurrenceOccurrenceDayIds({
            recurrence: EventRecurrence.Weekly,
            startDayId: "d0",
            linearDays,
            dayIndexOf,
            dateOf,
            recurrenceEndDate: "2026-06-14",
        });
        expect([...ids]).toEqual(["d7"]);
    });

    it("applies both bounds to a daily recurrence", () => {
        const ids = getRecurrenceOccurrenceDayIds({
            recurrence: EventRecurrence.Daily,
            startDayId: "d0",
            linearDays,
            dayIndexOf,
            dateOf,
            recurrenceStartDate: "2026-06-09", // d2
            recurrenceEndDate: "2026-06-11", // d4
        });
        expect([...ids].sort()).toEqual(["d2", "d3", "d4"]);
    });

    it("still honours per-day exceptions inside the window", () => {
        const ids = getRecurrenceOccurrenceDayIds({
            recurrence: EventRecurrence.Daily,
            startDayId: "d0",
            linearDays,
            dayIndexOf,
            dateOf,
            recurrenceStartDate: "2026-06-09",
            recurrenceEndDate: "2026-06-11",
            excludedDayIds: new Set(["d3"]),
        });
        expect([...ids].sort()).toEqual(["d2", "d4"]);
    });

    it("yields nothing when the window closes before the start day", () => {
        const ids = getRecurrenceOccurrenceDayIds({
            recurrence: EventRecurrence.Daily,
            startDayId: "d10",
            linearDays,
            dayIndexOf,
            dateOf,
            recurrenceEndDate: "2026-06-10",
        });
        expect(ids.size).toBe(0);
    });
});

describe("recurrence satisfaction with a start date (#468)", () => {
    it("resolves the first required week from the start date", () => {
        expect(
            getFirstRequiredRecurrenceWeekIdx("2026-06-21", weeks, dateOf),
        ).toBe(2);
    });

    it("falls back to week 1 with no start date", () => {
        expect(getFirstRequiredRecurrenceWeekIdx(null, weeks, dateOf)).toBe(0);
    });

    it("falls back to week 1 when the date is past the timeline", () => {
        expect(
            getFirstRequiredRecurrenceWeekIdx("2027-01-01", weeks, dateOf),
        ).toBe(0);
    });

    it("no longer demands that the event start in the first week", () => {
        // Mapped in week 3, recurrence configured to start in week 3.
        expect(isRecurrenceSatisfied(EventRecurrence.Weekly, 2, 2)).toBe(true);
        // Mapped later than the window's first week: still unsatisfied.
        expect(isRecurrenceSatisfied(EventRecurrence.Weekly, 2, 1)).toBe(false);
    });

    it("keeps the old rule when no window is configured", () => {
        expect(isRecurrenceSatisfied(EventRecurrence.Weekly, 0)).toBe(true);
        expect(isRecurrenceSatisfied(EventRecurrence.Weekly, 1)).toBe(false);
        expect(isRecurrenceSatisfied(EventRecurrence.None, 3)).toBe(true);
        expect(isRecurrenceSatisfied(EventRecurrence.Weekly, -1, 2)).toBe(false);
    });
});
