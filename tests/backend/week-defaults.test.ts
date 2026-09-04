import { afterEach, describe, expect, it } from "vitest";

import { getDefaultWorkingMinutesForDay } from "@/api-shared/gantt/week-defaults";
import { GanttDayIndex } from "@/api-shared/types/gantt/models";

describe("getDefaultWorkingMinutesForDay", () => {
    const weekdayKey = "NEXT_PUBLIC_GANT_DEFAULT_WEEKDAY_HOURS";
    const fridayKey = "NEXT_PUBLIC_GANT_DEFAULT_FRIDAY_HOURS";
    const originals = {
        [ weekdayKey ]: process.env[ weekdayKey ],
        [ fridayKey ]: process.env[ fridayKey ],
    };
    afterEach(() => {
        for (const [ key, value ] of Object.entries(originals)) {
            if (value === undefined) delete process.env[ key ];
            else process.env[ key ] = value;
        }
    });

    it("Saturday is always closed, even with an env override", () => {
        process.env[ weekdayKey ] = "9";

        expect(getDefaultWorkingMinutesForDay(GanttDayIndex.Saturday)).toBe(0);
    });

    it("falls back to 8h on weekdays and 6h on Friday", () => {
        delete process.env[ weekdayKey ];
        delete process.env[ fridayKey ];

        expect(getDefaultWorkingMinutesForDay(GanttDayIndex.Sunday)).toBe(480);
        expect(getDefaultWorkingMinutesForDay(GanttDayIndex.Thursday)).toBe(480);
        expect(getDefaultWorkingMinutesForDay(GanttDayIndex.Friday)).toBe(360);
    });

    it("uses the env overrides when they parse", () => {
        process.env[ weekdayKey ] = "9";
        process.env[ fridayKey ] = "5";

        expect(getDefaultWorkingMinutesForDay(GanttDayIndex.Monday)).toBe(540);
        expect(getDefaultWorkingMinutesForDay(GanttDayIndex.Friday)).toBe(300);
    });

    it("rounds fractional hours to whole minutes", () => {
        process.env[ weekdayKey ] = "7.51";

        expect(getDefaultWorkingMinutesForDay(GanttDayIndex.Tuesday)).toBe(451);
    });

    it("ignores non-numeric and negative overrides", () => {
        process.env[ weekdayKey ] = "abc";
        expect(getDefaultWorkingMinutesForDay(GanttDayIndex.Sunday)).toBe(480);

        process.env[ weekdayKey ] = "-3";
        expect(getDefaultWorkingMinutesForDay(GanttDayIndex.Sunday)).toBe(480);
    });

    it("honours an explicit zero-hour override", () => {
        process.env[ fridayKey ] = "0";

        expect(getDefaultWorkingMinutesForDay(GanttDayIndex.Friday)).toBe(0);
    });
});
