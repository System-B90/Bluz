import { describe, expect, it } from "vitest";

import { getWeekOverAllocationSeverity } from "@/components/gantt/curriculum-view/gantt-time-utils";

/**
 * #467: the weeks-view week header used to go red for any overloaded day.
 * Red now means the week itself is short of hours; a day that spills over
 * while the week still has room is amber, because the work can be moved.
 */

const day = (availableMinutes: number, scheduledMinutes: number) => ({
    availableMinutes,
    scheduledMinutes,
});

describe("getWeekOverAllocationSeverity (#467)", () => {
    it("is silent when every day fits", () => {
        expect(
            getWeekOverAllocationSeverity([day(480, 300), day(480, 480)]),
        ).toBeNull();
    });

    it("is amber when one day spills but the week still has room", () => {
        expect(
            getWeekOverAllocationSeverity([day(480, 600), day(480, 100)]),
        ).toBe("warning");
    });

    it("is red when the week's total exceeds its available hours", () => {
        expect(
            getWeekOverAllocationSeverity([day(480, 700), day(480, 500)]),
        ).toBe("error");
    });

    it("treats an exactly-full week as amber, not red", () => {
        expect(
            getWeekOverAllocationSeverity([day(480, 600), day(480, 360)]),
        ).toBe("warning");
    });

    it("is silent for an empty week", () => {
        expect(getWeekOverAllocationSeverity([])).toBeNull();
    });

    it("is red when a day with no hours at all is scheduled into", () => {
        expect(getWeekOverAllocationSeverity([day(0, 60)])).toBe("error");
    });
});
