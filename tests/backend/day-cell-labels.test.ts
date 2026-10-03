import { describe, expect, it } from "vitest";

import { dayHoursInputLabel, dayHoursStepLabel, REVEAL_ON_HOVER_OR_FOCUS } from "@/components/gantt/curriculum-view/tabs/weeks-tab/day-cell-labels";

/** Weeks-tab +/− buttons: named, and revealed on keyboard focus too (#842). */

describe("day cell labels", () => {
    it("names the steppers after the day", () => {
        expect(dayHoursStepLabel("up", "ראשון", "2/8")).toBe("הגדלת שעות — יום ראשון 2/8");
        expect(dayHoursStepLabel("down", "ראשון", "")).toBe("הקטנת שעות — יום ראשון");
        expect(dayHoursInputLabel("שני", "3/8")).toBe("שעות עבודה — יום שני 3/8");
    });

    it("reveals the buttons on focus-within, not only on hover", () => {
        expect(REVEAL_ON_HOVER_OR_FOCUS).toContain(":focus-within");
        expect(REVEAL_ON_HOVER_OR_FOCUS).toContain(":hover");
    });
});
