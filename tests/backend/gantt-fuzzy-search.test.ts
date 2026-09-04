import { describe, expect, it } from "vitest";

import {
    fuzzyScore,
    normalizeSearchText,
} from "@/components/gantt/curriculum-view/search/fuzzy";

describe("normalizeSearchText", () => {
    it("lowercases, collapses whitespace and trims", () => {
        expect(normalizeSearchText("  Foo   BAR ")).toBe("foo bar");
    });

    it("strips Hebrew gershayim/geresh and ASCII quotes", () => {
        expect(normalizeSearchText('ע"ע')).toBe("עע");
        expect(normalizeSearchText("ע״ע")).toBe("עע");
        expect(normalizeSearchText("ע׳")).toBe("ע");
        expect(normalizeSearchText('"foo"')).toBe("foo");
    });
});

describe("fuzzyScore", () => {
    it("matches across gershayim in either direction", () => {
        expect(fuzzyScore("עע", 'ע"ע')).toBeGreaterThan(0);
        expect(fuzzyScore('ע"ע', "עע")).toBeGreaterThan(0);
    });

    it("treats an empty query as a match and an empty target as no match", () => {
        expect(fuzzyScore("", "anything")).toBe(1);
        expect(fuzzyScore("abc", "")).toBe(0);
    });

    it("scores a contiguous match far above a scattered one", () => {
        const contiguous = fuzzyScore("abc", "abcdef");
        const scattered = fuzzyScore("abc", "axbxcx");

        expect(contiguous).toBeGreaterThan(scattered);
        expect(scattered).toBeGreaterThan(0);
    });

    it("prefers an earlier contiguous match", () => {
        expect(fuzzyScore("abc", "abcxxxx")).toBeGreaterThan(
            fuzzyScore("abc", "xxxxabc"),
        );
    });

    it("rewards consecutive runs inside a subsequence match", () => {
        expect(fuzzyScore("abc", "abxxxc")).toBeGreaterThan(
            fuzzyScore("abc", "axbxcx"),
        );
    });

    it("returns 0 unless every query character appears in order", () => {
        expect(fuzzyScore("abc", "acb")).toBe(0);
        expect(fuzzyScore("abcd", "abc")).toBe(0);
    });

    it("is case-insensitive", () => {
        expect(fuzzyScore("ABC", "abcdef")).toBe(fuzzyScore("abc", "ABCDEF"));
    });
});
