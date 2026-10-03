import { describe, expect, it } from "vitest";

import { getDayChipLabel } from "@/components/gantt/curriculum-view/tabs/weeks-tab/day-chip-label";

/** Weeks-tab day chips: short visible text, full sentence for tooltip/SR (#841). */

describe("getDayChipLabel", () => {
    it("shows scheduled / available instead of the long sentence", () => {
        const label = getDayChipLabel(360, 18);
        expect(label.short).toBe("0.3 / 6 ש׳");
        expect(label.short.length).toBeLessThanOrEqual(12);
        expect(label.full).toContain("נותרו 5.7 ש׳");
        expect(label.over).toBe(false);
    });

    it("flags an over-allocated day and keeps the overflow in the full text", () => {
        const label = getDayChipLabel(360, 480);
        expect(label.over).toBe(true);
        expect(label.short).toBe("8 / 6 ש׳");
        expect(label.full).toContain("חריגה 2 ש׳");
    });

    it("keeps closed and free days readable", () => {
        expect(getDayChipLabel(0, 0).short).toBe("סגור");
        expect(getDayChipLabel(360, 0).full).toContain("פנוי");
    });
});
