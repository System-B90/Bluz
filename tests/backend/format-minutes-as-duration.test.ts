import { describe, expect, it } from "vitest";

import { formatMinutesAsDuration } from "@/components/gantt/curriculum-view/gantt-time-utils";

/**
 * The syllabus card shows its scheduled / minimum / tentative time as
 * hours:minutes. Totals routinely exceed a day, so unlike the time-input
 * formatter this one must not clamp at 24 hours.
 */

describe("formatMinutesAsDuration", () => {
    it("formats zero", () => {
        expect(formatMinutesAsDuration(0)).toBe("0:00");
    });

    it("pads minutes but not hours", () => {
        expect(formatMinutesAsDuration(65)).toBe("1:05");
        expect(formatMinutesAsDuration(750)).toBe("12:30");
    });

    it("does not clamp past 24 hours", () => {
        expect(formatMinutesAsDuration(100 * 60 + 15)).toBe("100:15");
    });

    it("rounds fractional minutes", () => {
        expect(formatMinutesAsDuration(89.6)).toBe("1:30");
    });

    it("treats negative and non-finite input as zero", () => {
        expect(formatMinutesAsDuration(-30)).toBe("0:00");
        expect(formatMinutesAsDuration(Number.NaN)).toBe("0:00");
        expect(formatMinutesAsDuration(Number.POSITIVE_INFINITY)).toBe("0:00");
    });
});
