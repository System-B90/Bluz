import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import {
    formatShortDate,
    formatWeekDateRange,
    getWeekDateRange,
} from "@/components/gantt/curriculum-view/gantt-time-utils";

/** Gantt dates read like the calendar's: `DD/MM`, never a decimal-looking `3.10` (#814). */
describe("gantt short dates (#814)", () => {
    it("pads day and month and uses a slash", () => {
        expect(formatShortDate(dayjs("2026-08-02"))).toBe("02/08");
        expect(formatShortDate(dayjs("2026-10-03"))).toBe("03/10");
    });

    it("joins a week range with an en dash", () => {
        expect(formatWeekDateRange(getWeekDateRange("2026-09-27", 0))).toBe("27/09–03/10");
    });

    it("is empty without a start date", () => {
        expect(formatWeekDateRange(getWeekDateRange(null, 0))).toBe("");
    });
});
