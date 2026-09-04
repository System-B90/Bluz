import { describe, it, expect } from "vitest";

import { getHolidayComment } from "@/api-shared/gantt/holidays";

// UTC noon avoids any local-timezone date-rollover flakiness.
const utcDate = (isoDate: string): Date => new Date(`${isoDate}T12:00:00Z`);

describe("getHolidayComment", () => {
    it("marks Rosh Hashana (5787) on its civil date", () => {
        expect(getHolidayComment(utcDate("2026-09-12"))).toBe("ראש השנה 5787");
    });

    it("marks erev Rosh Hashana the day before", () => {
        expect(getHolidayComment(utcDate("2026-09-11"))).toBe("ערב ראש השנה");
    });

    it("marks Yom Kippur", () => {
        expect(getHolidayComment(utcDate("2026-09-21"))).toBe("יום כיפור");
    });

    it("marks the first day of Pesach without duplicating Diaspora/Israel readings", () => {
        expect(getHolidayComment(utcDate("2026-04-02"))).toBe("פסח א׳");
    });

    it("marks a day with multiple concurrent holidays, one per line", () => {
        const comment = getHolidayComment(utcDate("2026-04-01"));
        expect(comment).toBe("תענית בכורות\nערב פסח");
    });

    it("returns undefined for an ordinary day with no holiday", () => {
        expect(getHolidayComment(utcDate("2026-01-05"))).toBeUndefined();
    });

    it("marks Dec 31st as Novi God regardless of the Hebrew date", () => {
        expect(getHolidayComment(utcDate("2025-12-31"))).toBe(
            "נובי גוד - יום חופש ליוצאי ברית המועצות",
        );
        expect(getHolidayComment(utcDate("2026-12-31"))).toBe(
            "נובי גוד - יום חופש ליוצאי ברית המועצות",
        );
    });

    it("forces the Novi God comment on Dec 31st even over another Jewish holiday", () => {
        // Dec 31 2025 is otherwise an unremarkable Hebrew date; this just
        // pins the override so a future hebcal bump can't silently change it.
        expect(getHolidayComment(utcDate("2024-12-31"))).toBe(
            "נובי גוד - יום חופש ליוצאי ברית המועצות",
        );
    });
});
