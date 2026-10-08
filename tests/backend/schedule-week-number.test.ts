import { describe, expect, it } from "vitest";

import { iterationWeekNumber } from "@/components/schedule/calendar/calendar/schedule-week";

/** Week numbers under the schedule's date range, counted from the iteration start. */
describe("iterationWeekNumber", () => {
    // Wednesday 2026-09-02 (Israel); its week starts Sunday 2026-08-30.
    const start = "2026-09-02T00:00:00+03:00";

    it("numbers the week holding the start date as 1", () => {
        expect(iterationWeekNumber(new Date("2026-08-30T10:00:00+03:00"), start)).toBe(1);
        expect(iterationWeekNumber(new Date("2026-09-05T20:00:00+03:00"), start)).toBe(1);
    });

    it("counts Sunday-started weeks from there", () => {
        expect(iterationWeekNumber(new Date("2026-09-06T09:00:00+03:00"), start)).toBe(2);
        expect(iterationWeekNumber(new Date("2026-09-23T09:00:00+03:00"), start)).toBe(4);
    });

    it("stays exact across the October daylight-saving switch", () => {
        // Israel leaves DST on 2026-10-25; that week is an hour longer.
        expect(iterationWeekNumber(new Date("2026-10-25T09:00:00+02:00"), start)).toBe(9);
        expect(iterationWeekNumber(new Date("2026-11-01T09:00:00+02:00"), start)).toBe(10);
    });

    it("has no number before the iteration or without a start date", () => {
        expect(iterationWeekNumber(new Date("2026-08-29T10:00:00+03:00"), start)).toBeNull();
        expect(iterationWeekNumber(new Date("2026-09-06T09:00:00+03:00"), null)).toBeNull();
        expect(iterationWeekNumber(new Date("2026-09-06T09:00:00+03:00"), undefined)).toBeNull();
    });
});
