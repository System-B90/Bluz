import { describe, expect, it } from "vitest";

import { dayRangeHeaderFormat } from "@/components/schedule/calendar/calendar/range-header";

/** Strips the bidi isolate marks so assertions read the visible text. */
const visible = (text: string) => text.replace(/[⁦-⁩]/g, "");

describe("dayRangeHeaderFormat (#653)", () => {
    it("names both years for a week across New Year", () => {
        const header = visible(
            dayRangeHeaderFormat({
                start: new Date("2025-12-28T10:00:00Z"),
                end: new Date("2026-01-03T10:00:00Z"),
            }),
        );
        expect(header).toContain("2025");
        expect(header).toContain("2026");
    });

    it("keeps one trailing year for a range inside a single year", () => {
        const header = visible(
            dayRangeHeaderFormat({
                start: new Date("2026-09-06T10:00:00Z"),
                end: new Date("2026-09-12T10:00:00Z"),
            }),
        );
        expect(header.match(/2026/g)).toHaveLength(1);
    });
});
