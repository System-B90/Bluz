import { describe, expect, it } from "vitest";

import {
    isShuffleHiveGroups,
    normalizeShuffleHiveGroups,
    normalizeShuffleRenames,
    renameShuffleKeys,
    retagShuffles,
} from "@/api-shared/gantt/shuffle-names";

describe("normalizeShuffleRenames (#774)", () => {
    it("normalizes both sides and drops blank or no-op renames", () => {
        expect(
            normalizeShuffleRenames({ " א ": "ב  ג", ד: "ד", "": "ה", ו: " " }),
        ).toEqual({ א: "ב ג" });
    });

    it("treats undefined as no renames", () => {
        expect(normalizeShuffleRenames(undefined)).toEqual({});
    });
});

describe("retagShuffles (#774)", () => {
    it("drops removed names and rewrites renamed ones in order", () => {
        expect(retagShuffles([ "א", "ב", "ג" ], [ "ב" ], { ג: "ד" })).toEqual([
            "א",
            "ד",
        ]);
    });

    it("regression: a rename onto a name the item already has does not duplicate it", () => {
        expect(retagShuffles([ "א", "ב" ], [], { א: "ב" })).toEqual([ "ב" ]);
    });
});

describe("renameShuffleKeys (#774)", () => {
    it("moves renamed entries and keeps the rest", () => {
        expect(renameShuffleKeys({ א: 1, ב: 2 }, { א: "ג" })).toEqual({ ג: 1, ב: 2 });
    });
});

describe("normalizeShuffleHiveGroups (#774)", () => {
    it("keeps only links of existing shuffles to positive integer ids", () => {
        expect(
            normalizeShuffleHiveGroups(
                { " א ": 5, ב: 0, ג: 1.5, ד: 7 },
                [ "א", "ב", "ג" ],
            ),
        ).toEqual({ א: 5 });
    });
});

describe("isShuffleHiveGroups (#774)", () => {
    it("accepts a string→number record only", () => {
        expect(isShuffleHiveGroups({ א: 1 })).toBe(true);
        expect(isShuffleHiveGroups({ א: "1" })).toBe(false);
        expect(isShuffleHiveGroups([ 1 ])).toBe(false);
        expect(isShuffleHiveGroups(null)).toBe(false);
    });
});
