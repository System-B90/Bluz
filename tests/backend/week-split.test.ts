import { describe, expect, it } from "vitest";

import {
    getEffectiveWeekSplit,
    getWeekSplitDayIds,
    isWeekSplitComplete,
    isWeekSplitMinutes,
} from "@/api-shared/gantt/week-split";

const WEEKS = [
    { days: [ "w1d1", "w1d2", "w1d3" ] },
    { days: [ "w2d1", "w2d2", "w2d3" ] },
    { days: [ "w3d1" ] },
];

describe("isWeekSplitMinutes (#768)", () => {
    it("accepts positive whole minutes, including an empty list", () => {
        expect(isWeekSplitMinutes([ 180, 240 ])).toBe(true);
        expect(isWeekSplitMinutes([])).toBe(true);
    });

    it("accepts a skipped (0-hour) later week", () => {
        expect(isWeekSplitMinutes([ 180, 0, 240 ])).toBe(true);
    });

    it("rejects non-arrays, an empty first week, negatives and fractions", () => {
        for (const bad of [ "180", null, [ 0 ], [ 0, 60 ], [ -60 ], [ 1.5 ], [ "60" ] ]) {
            expect(isWeekSplitMinutes(bad)).toBe(false);
        }
    });
});

describe("isWeekSplitComplete (#768)", () => {
    it("needs at least two parts summing to the whole", () => {
        expect(isWeekSplitComplete([ 180, 180, 240 ], 600)).toBe(true);
        expect(isWeekSplitComplete([ 600 ], 600)).toBe(false);
        expect(isWeekSplitComplete([ 180, 180 ], 600)).toBe(false);
    });
});

describe("getEffectiveWeekSplit (#768)", () => {
    it("splits only a flagged event with a complete split", () => {
        expect(getEffectiveWeekSplit(true, [ 300, 300 ], 600)).toEqual([ 300, 300 ]);
        expect(getEffectiveWeekSplit(false, [ 300, 300 ], 600)).toBeNull();
        expect(getEffectiveWeekSplit(undefined, [ 300, 300 ], 600)).toBeNull();
        expect(getEffectiveWeekSplit(true, undefined, 600)).toBeNull();
    });

    it("regression: a stale split no longer matching the duration runs whole", () => {
        expect(getEffectiveWeekSplit(true, [ 300, 300 ], 480)).toBeNull();
    });
});

describe("getWeekSplitDayIds (#768)", () => {
    it("keeps the mapped day's position in each following week", () => {
        expect(getWeekSplitDayIds("w1d2", 2, WEEKS)).toEqual([ "w1d2", "w2d2" ]);
    });

    it("clamps the position in a shorter week", () => {
        expect(getWeekSplitDayIds("w2d3", 2, WEEKS)).toEqual([ "w2d3", "w3d1" ]);
    });

    it("drops parts past the timeline's end", () => {
        expect(getWeekSplitDayIds("w2d1", 3, WEEKS)).toEqual([ "w2d1", "w3d1" ]);
    });

    it("returns nothing for a day outside the timeline", () => {
        expect(getWeekSplitDayIds("nope", 2, WEEKS)).toEqual([]);
    });
});
