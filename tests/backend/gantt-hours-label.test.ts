import { afterEach, describe, expect, it } from "vitest";

import { formatHoursLabel, setHoursFormat } from "@/components/gantt/curriculum-view/gantt-time-utils";

/**
 * One duration formatter for the whole gantt (#813). The syllabus card used to
 * write `177:15`, the timeline `177.3 ש׳` and the sidebar a bare `543.50`.
 */

afterEach(() => setHoursFormat("decimal"));

describe("formatHoursLabel (#813)", () => {
    it("writes decimal hours with the unit", () => {
        expect(formatHoursLabel(177 * 60 + 15)).toBe("177.3 ש׳");
        expect(formatHoursLabel(0)).toBe("0 ש׳");
    });

    it("writes clock hours with the unit, so they don't read as a time of day", () => {
        setHoursFormat("clock");
        expect(formatHoursLabel(177 * 60 + 15)).toBe("177:15 ש׳");
        expect(formatHoursLabel(600)).toBe("10:00 ש׳");
    });

    it("does not clamp past 24 hours", () => {
        setHoursFormat("clock");
        expect(formatHoursLabel(100 * 60 + 15)).toBe("100:15 ש׳");
    });
});
