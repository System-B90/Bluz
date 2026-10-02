import { describe, expect, it } from "vitest";

import {
    parseHoursInput,
    planWeekAllotment,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-allotment";

/** Grid week-cell edits planned onto an event's mappings' allotted minutes. */

const WEEKS = [ [ "a1", "a2", "a3" ], [ "b1", "b2", "b3" ], [ "c1", "c2" ] ];
const plan = (week: number, minutes: number, mappings: Array<[ string, number ]>, extra: { echoDayId?: string; splitAcrossWeeks?: boolean } = {}) =>
    planWeekAllotment({
        minutes,
        weekDays: WEEKS[ week ],
        mappings: mappings.map(([ dayId, allottedMinutes ]) => ({ dayId, allottedMinutes })),
        weekDaysOf: (dayId) => WEEKS.find((days) => days.includes(dayId)) ?? [],
        splitAcrossWeeks: false,
        ...extra,
    });

describe("parseHoursInput", () => {
    it("reads decimal and clock hours, blank as 0, rejects junk", () => {
        expect([ "1.5", "2", ".25", "1:30", "0:05", "" ].map(parseHoursInput)).toEqual([ 90, 120, 15, 90, 5, 0 ]);
        expect([ "abc", "1:75", "-1", "1,5" ].map(parseHoursInput)).toEqual([ null, null, null, null ]);
    });
});

describe("planWeekAllotment", () => {
    it("sets the week's only mapping, and does nothing for an unchanged value", () => {
        expect(plan(0, 120, [ [ "a2", 90 ] ])).toEqual({ kind: "set", changes: [ { dayId: "a2", minutes: 120 } ] });
        expect(plan(0, 90, [ [ "a2", 90 ] ])).toEqual({ kind: "none" });
    });

    it("lets the week's last mapping absorb the difference, earlier ones only once it is spent", () => {
        expect(plan(0, 150, [ [ "a1", 60 ], [ "a3", 60 ] ])).toEqual({ kind: "set", changes: [ { dayId: "a3", minutes: 90 } ] });
        expect(plan(0, 30, [ [ "a1", 60 ], [ "a3", 60 ] ])).toEqual({
            kind: "set",
            changes: [ { dayId: "a3", minutes: 0 }, { dayId: "a1", minutes: 30 } ],
        });
    });

    it("asks before zeroing a week, and ignores 0 on an empty week", () => {
        expect(plan(0, 0, [ [ "a1", 60 ], [ "a3", 60 ] ])).toEqual({ kind: "zero", dayIds: [ "a1", "a3" ] });
        expect(plan(1, 0, [ [ "a1", 60 ] ])).toEqual({ kind: "none" });
    });

    it("maps an unplaced event on the week's first day", () => {
        expect(plan(1, 60, [])).toEqual({ kind: "create", dayId: "b1", minutes: 60 });
    });

    it("puts a new week on the first mapping's weekday, clamped to shorter weeks", () => {
        expect(plan(1, 60, [ [ "a2", 90 ] ], { splitAcrossWeeks: true })).toEqual({ kind: "create", dayId: "b2", minutes: 60 });
        expect(plan(2, 60, [ [ "a3", 90 ] ], { splitAcrossWeeks: true })).toEqual({ kind: "create", dayId: "c2", minutes: 60 });
    });

    it("asks to move or split when an unsplittable event sits in another week", () => {
        expect(plan(1, 60, [ [ "a2", 90 ] ])).toEqual({ kind: "outside", dayId: "b2", fromDayId: "a2", minutes: 60 });
    });

    it("materializes a recurrence echo rather than editing the recurring event", () => {
        expect(plan(1, 45, [ [ "a2", 90 ] ], { echoDayId: "b2" })).toEqual({ kind: "materialize", dayId: "b2", minutes: 45 });
        // The root's own week edits the root.
        expect(plan(0, 45, [ [ "a2", 90 ] ], { echoDayId: "b2" }).kind).toBe("set");
    });
});
