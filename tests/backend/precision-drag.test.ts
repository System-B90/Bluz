import { describe, expect, it } from "vitest";

import { dampDragDelta } from "@/components/schedule/calendar/calendar/UsePrecisionDrag";

const MINUTE = 60_000;

describe("Alt-drag precision damping (#475)", () => {
    it("leaves an ordinary drag untouched", () => {
        expect(dampDragDelta(30 * MINUTE, false)).toBe(30 * MINUTE);
        expect(dampDragDelta(-45 * MINUTE, false)).toBe(-45 * MINUTE);
    });

    it("applies a quarter of the pointer's travel", () => {
        expect(dampDragDelta(60 * MINUTE, true)).toBe(15 * MINUTE);
        expect(dampDragDelta(-60 * MINUTE, true)).toBe(-15 * MINUTE);
    });

    it("resolves below the grid's 5-minute step", () => {
        // One grid step of travel becomes a single minute — the adjustment the
        // 5-minute snap cannot express on its own.
        expect(dampDragDelta(5 * MINUTE, true)).toBe(MINUTE);
    });

    it("snaps to whole minutes rather than to fractions", () => {
        expect(dampDragDelta(10 * MINUTE, true) % MINUTE).toBe(0);
        expect(dampDragDelta(35 * MINUTE, true) % MINUTE).toBe(0);
    });

    it("keeps a zero drag a no-op", () => {
        expect(dampDragDelta(0, true)).toBe(0);
    });
});
