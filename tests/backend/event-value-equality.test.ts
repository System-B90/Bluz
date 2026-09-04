import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import { areValuesEqual } from "@/components/schedule/types/EventUtils";

/**
 * This comparison decides what counts as a conflict when offline edits are
 * pushed. Anything it calls "equal" is a remote change that gets silently
 * overwritten, so a loose answer here costs real work.
 */
describe("areValuesEqual (#632)", () => {
    it("does not treat a number and its string form as equal", () => {
        // `String(a) === String(b)` said these matched, so a server field that
        // changed type slipped past the conflict check.
        expect(areValuesEqual(5, "5")).toBe(false);
        expect(areValuesEqual("5", 5)).toBe(false);
    });

    it("does not treat a boolean and its string form as equal", () => {
        expect(areValuesEqual(true, "true")).toBe(false);
        expect(areValuesEqual(false, "")).toBe(false);
    });

    it("does not equate an array with an object carrying the same keys", () => {
        expect(areValuesEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
        expect(areValuesEqual({ 0: 1, 1: 2 }, [1, 2])).toBe(false);
    });

    it("still matches identical primitives", () => {
        expect(areValuesEqual(5, 5)).toBe(true);
        expect(areValuesEqual("שיעור", "שיעור")).toBe(true);
        expect(areValuesEqual(true, true)).toBe(true);
    });

    it("still matches equal arrays and objects element by element", () => {
        expect(areValuesEqual([1, 2, 3], [1, 2, 3])).toBe(true);
        expect(areValuesEqual({ a: 1, b: "x" }, { b: "x", a: 1 })).toBe(true);
        expect(areValuesEqual([1, 2], [2, 1])).toBe(false);
    });

    it("still matches the same instant across Date, Dayjs and ISO string", () => {
        const iso = "2026-01-14T09:00:00.000Z";

        expect(areValuesEqual(new Date(iso), dayjs(iso))).toBe(true);
        expect(areValuesEqual(iso, new Date(iso))).toBe(true);
    });

    it("keeps null and undefined distinct from each other and from falsy values", () => {
        expect(areValuesEqual(null, undefined)).toBe(false);
        expect(areValuesEqual(null, 0)).toBe(false);
        expect(areValuesEqual(undefined, "")).toBe(false);
        expect(areValuesEqual(null, null)).toBe(true);
    });
});
