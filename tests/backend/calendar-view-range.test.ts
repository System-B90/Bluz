import { describe, expect, it } from "vitest";

import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
import {
    getRangeForView,
    isWeekendInAppTimezone,
} from "@/components/schedule/calendar/utils";

/**
 * The calendar's range is not cosmetic: it scopes every fetch and the ICS
 * export. A range that disagrees with the grid on screen hands the user events
 * they cannot see, and a weekday resolved in the viewer's own timezone puts the
 * wrong columns in the work week.
 */
describe("calendar range for the work week (#611)", () => {
    // Wednesday 2026-01-14, mid-week so the range has to be derived, not
    // read off the anchor date itself.
    const ANCHOR = new Date("2026-01-14T09:00:00+02:00");

    it("ends the work week on Thursday, not Saturday", () => {
        const { start, end } = getRangeForView(ANCHOR, "work_week");

        expect(dayjs(start).tz(APP_TIMEZONE).day()).toBe(0); // Sunday
        expect(dayjs(end).tz(APP_TIMEZONE).day()).toBe(4); // Thursday
    });

    it("excludes Friday and Saturday from the work-week range", () => {
        const { end } = getRangeForView(ANCHOR, "work_week");
        const friday = dayjs(ANCHOR).tz(APP_TIMEZONE).day(5).startOf("day");

        expect(dayjs(end).isBefore(friday)).toBe(true);
    });

    it("still spans the full Sun–Sat week for the plain week view", () => {
        const { start, end } = getRangeForView(ANCHOR, "week");

        expect(dayjs(start).tz(APP_TIMEZONE).day()).toBe(0);
        expect(dayjs(end).tz(APP_TIMEZONE).day()).toBe(6);
    });
});

describe("weekday resolution pinned to Israel time (#613)", () => {
    it("treats Friday and Saturday in Israel time as the weekend", () => {
        // Friday 2026-01-16 and Saturday 2026-01-17, Israel wall clock.
        expect(
            isWeekendInAppTimezone(new Date("2026-01-16T12:00:00+02:00")),
        ).toBe(true);
        expect(
            isWeekendInAppTimezone(new Date("2026-01-17T12:00:00+02:00")),
        ).toBe(true);
    });

    it("keeps Sunday–Thursday inside the work week", () => {
        for (const day of [ 18, 19, 20, 21, 22 ])
        {
            expect(
                isWeekendInAppTimezone(
                    new Date(`2026-01-${day}T12:00:00+02:00`),
                ),
            ).toBe(false);
        }
    });

    it("resolves a midnight-boundary instant by Israel time, not the browser's", () => {
        // Friday 2026-01-16 00:30 in Israel is still Thursday 22:30 UTC. A
        // viewer west of Israel reading getDay() would call this Thursday and
        // leave a Friday column in the work-week grid.
        const justAfterMidnightInIsrael = new Date("2026-01-16T00:30:00+02:00");

        expect(justAfterMidnightInIsrael.getUTCDay()).toBe(4); // Thursday, UTC
        expect(isWeekendInAppTimezone(justAfterMidnightInIsrael)).toBe(true);
    });
});
