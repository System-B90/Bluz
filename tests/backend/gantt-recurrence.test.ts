import { describe, it, expect } from "vitest";

import { EventRecurrence, GanttDayIndex } from "@/api-shared/types/gantt/models";
import {
    getOccurrenceDayIdForWeek,
    getRecurrenceOccurrenceDayIds,
    isRecurrenceSatisfied,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/recurrence";

describe("getRecurrenceOccurrenceDayIds", () => {
    // Two 7-day weeks: d0..d6 (week 1), d7..d13 (week 2).
    const linearDays = Array.from({ length: 14 }, (_, i) => `d${i}`);
    const dayIndexOf = (dayId: string): GanttDayIndex | undefined => {
        const i = linearDays.indexOf(dayId);
        if (i === -1) return undefined;
        return (i % 7) as GanttDayIndex;
    };

    it("returns an empty set for EventRecurrence.None", () => {
        const ids = getRecurrenceOccurrenceDayIds({
            recurrence: EventRecurrence.None,
            startDayId: "d0",
            linearDays,
            dayIndexOf,
        });
        expect(ids.size).toBe(0);
    });

    it("returns an empty set when unmapped (no start day)", () => {
        const ids = getRecurrenceOccurrenceDayIds({
            recurrence: EventRecurrence.Daily,
            startDayId: null,
            linearDays,
            dayIndexOf,
        });
        expect(ids.size).toBe(0);
    });

    it("daily recurrence echoes onto every following day, excluding the start day", () => {
        const ids = getRecurrenceOccurrenceDayIds({
            recurrence: EventRecurrence.Daily,
            startDayId: "d3",
            linearDays,
            dayIndexOf,
        });
        expect(ids.has("d3")).toBe(false);
        expect([...ids].sort()).toEqual(
            ["d4", "d5", "d6", "d7", "d8", "d9", "d10", "d11", "d12", "d13"].sort(),
        );
    });

    it("weekly recurrence echoes only onto the same weekday in later weeks", () => {
        // d2 is dayIndex 2 (Tuesday); d9 (week 2, position 2) shares that weekday.
        const ids = getRecurrenceOccurrenceDayIds({
            recurrence: EventRecurrence.Weekly,
            startDayId: "d2",
            linearDays,
            dayIndexOf,
        });
        expect([...ids]).toEqual(["d9"]);
    });

    it("weekly recurrence produces no occurrences when the start day is in the last week", () => {
        const ids = getRecurrenceOccurrenceDayIds({
            recurrence: EventRecurrence.Weekly,
            startDayId: "d9",
            linearDays,
            dayIndexOf,
        });
        expect(ids.size).toBe(0);
    });

    it("returns an empty set when the start day isn't part of the timeline", () => {
        const ids = getRecurrenceOccurrenceDayIds({
            recurrence: EventRecurrence.Daily,
            startDayId: "not-in-timeline",
            linearDays,
            dayIndexOf,
        });
        expect(ids.size).toBe(0);
    });

    it("skips excluded days for daily recurrence (deleted/materialized occurrences)", () => {
        const ids = getRecurrenceOccurrenceDayIds({
            recurrence: EventRecurrence.Daily,
            startDayId: "d3",
            linearDays,
            dayIndexOf,
            excludedDayIds: new Set(["d5", "d8"]),
        });
        expect([...ids].sort()).toEqual(
            ["d4", "d6", "d7", "d9", "d10", "d11", "d12", "d13"].sort(),
        );
    });

    it("skips an excluded day for weekly recurrence", () => {
        // d2 and d9 share a weekday; excluding d9 leaves no occurrences.
        const ids = getRecurrenceOccurrenceDayIds({
            recurrence: EventRecurrence.Weekly,
            startDayId: "d2",
            linearDays,
            dayIndexOf,
            excludedDayIds: new Set(["d9"]),
        });
        expect(ids.size).toBe(0);
    });
});

describe("getOccurrenceDayIdForWeek", () => {
    const linearDays = Array.from({ length: 14 }, (_, i) => `d${i}`);
    const dayIndexOf = (dayId: string): GanttDayIndex | undefined => {
        const i = linearDays.indexOf(dayId);
        if (i === -1) return undefined;
        return (i % 7) as GanttDayIndex;
    };
    const week2Days = linearDays.slice(7, 14);

    it("finds the day within the week matching the start weekday", () => {
        const dow = dayIndexOf("d2");
        expect(getOccurrenceDayIdForWeek(week2Days, dow, dayIndexOf)).toBe("d9");
    });

    it("returns null when the start weekday is unknown", () => {
        expect(
            getOccurrenceDayIdForWeek(week2Days, undefined, dayIndexOf),
        ).toBeNull();
    });

    it("returns null when no day in the week matches the weekday", () => {
        expect(
            getOccurrenceDayIdForWeek([], dayIndexOf("d2"), dayIndexOf),
        ).toBeNull();
    });
});

describe("isRecurrenceSatisfied", () => {
    it("is always satisfied for EventRecurrence.None, regardless of placement", () => {
        expect(isRecurrenceSatisfied(EventRecurrence.None, -1)).toBe(true);
        expect(isRecurrenceSatisfied(EventRecurrence.None, 0)).toBe(true);
        expect(isRecurrenceSatisfied(EventRecurrence.None, 3)).toBe(true);
    });

    it("is unsatisfied for a recurring event with no start day mapped", () => {
        expect(isRecurrenceSatisfied(EventRecurrence.Weekly, -1)).toBe(false);
        expect(isRecurrenceSatisfied(EventRecurrence.Daily, -1)).toBe(false);
    });

    it("is satisfied for a recurring event starting in the first week", () => {
        expect(isRecurrenceSatisfied(EventRecurrence.Weekly, 0)).toBe(true);
        expect(isRecurrenceSatisfied(EventRecurrence.Daily, 0)).toBe(true);
    });

    it("is unsatisfied for a recurring event starting after the first week", () => {
        // Forward-only echo means starting later than week 0 can never cover
        // every week of the curriculum.
        expect(isRecurrenceSatisfied(EventRecurrence.Weekly, 1)).toBe(false);
        expect(isRecurrenceSatisfied(EventRecurrence.Weekly, 4)).toBe(false);
    });
});
