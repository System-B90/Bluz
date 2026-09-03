import { describe, expect, it } from "vitest";

import { buildScheduleIcsCalendar } from "@/app/api/event/export/ics/calendar";
import { DbEventDocument } from "@/api-shared/types/event";
import { formatRange, isolateLtr } from "@/components/base/bidi";
import { dayRangeHeaderFormat } from "@/components/schedule/calendar/calendar/range-header";
import { eventTimeRange } from "@/components/schedule/event-component/use-event-duration";
import { toDateInputValue } from "@/components/settings-dialog/tabs/global/iteration-settings/values";

function makeEvent(overrides: Partial<DbEventDocument> = {}): DbEventDocument {
    return {
        id: "evt-1",
        name: "הרצאה",
        type: "lecture",
        startTime: new Date("2026-09-01T07:00:00.000Z"),
        endTime: new Date("2026-09-01T09:00:00.000Z"),
        ...overrides,
    } as DbEventDocument;
}

/** Unfolds RFC 5545 continuation lines so a logical line can be asserted on. */
function unfold(ics: string): Array<string> {
    return ics.replace(/\r\n /g, "").split("\r\n");
}

describe("#566 — ICS export", () => {
    it("emits a real line-break escape in DESCRIPTION, not a literal backslash-n", () => {
        const ics = buildScheduleIcsCalendar(
            [makeEvent({ notes: "ההערות של המופע" })],
            "לוח",
        );
        const description = unfold(ics).find((l) => l.startsWith("DESCRIPTION:"));

        // The wire form is a single backslash followed by `n`. Escaping the
        // joiner as text produced `\\n`, which parsers render as literal "\n".
        expect(description).toContain("\\n");
        expect(description).not.toContain("\\\\n");
    });

    it("still escapes a backslash the user actually typed", () => {
        const ics = buildScheduleIcsCalendar(
            [makeEvent({ notes: "path C:\\temp" })],
            "לוח",
        );
        const description = unfold(ics).find((l) => l.startsWith("DESCRIPTION:"));
        expect(description).toContain("C:\\\\temp");
    });

    it("normalizes CRLF in notes instead of leaving a bare CR", () => {
        const ics = buildScheduleIcsCalendar(
            [makeEvent({ notes: "line1\r\nline2" })],
            "לוח",
        );
        const description = unfold(ics).find((l) => l.startsWith("DESCRIPTION:"));
        // A bare CR would survive into the content line; only the `\n` escape
        // should remain.
        expect(description).toContain("line1\\nline2");
        expect(description).not.toContain("\r");
    });

    it("folds on octets, not characters, for Hebrew text", () => {
        // 80 Hebrew characters = 160 UTF-8 octets: one line under the old
        // character-based fold, several under an octet-correct one.
        const ics = buildScheduleIcsCalendar(
            [makeEvent({ name: "א".repeat(80) })],
            "לוח",
        );
        for (const line of ics.split("\r\n")) {
            expect(Buffer.from(line, "utf8").length).toBeLessThanOrEqual(75);
        }
    });

    it("never splits a multi-byte sequence when folding", () => {
        const ics = buildScheduleIcsCalendar(
            [makeEvent({ name: "א".repeat(80) })],
            "לוח",
        );
        // A split sequence would decode to U+FFFD on the round-trip.
        expect(ics).not.toContain("\uFFFD");
        expect(unfold(ics).find((l) => l.startsWith("SUMMARY:"))).toBe(
            `SUMMARY:${"א".repeat(80)}`,
        );
    });
});

describe("#567 — iteration start date", () => {
    it("formats in the venue timezone, not UTC", () => {
        // Local midnight in Asia/Jerusalem is the previous day in UTC, which is
        // what a date-only picker stores.
        expect(toDateInputValue("2026-08-31T21:00:00.000Z")).toBe("2026-09-01");
    });

    it("returns an empty string for unset or invalid input", () => {
        expect(toDateInputValue(null)).toBe("");
        expect(toDateInputValue(undefined)).toBe("");
        expect(toDateInputValue("not a date")).toBe("");
    });
});

describe("#569 — bidi isolation of ranges", () => {
    it("wraps a range in isolate marks so RTL context cannot reverse it", () => {
        const range = formatRange("10:00", "12:00");
        expect(range).toBe("\u2066" + "10:00 - 12:00" + "\u2069");
    });

    it("keeps the sides in source order inside the isolate", () => {
        // The defect was never in the string itself — it was the layout. What
        // matters is that the isolate is present and the content unchanged.
        const inner = formatRange("05", "11").slice(1, -1);
        expect(inner).toBe("05 - 11");
    });

    it("isolateLtr is idempotent in content", () => {
        expect(isolateLtr("abc")).toContain("abc");
        expect(isolateLtr("abc")).toHaveLength(5);
    });

    describe("call sites actually isolate", () => {
        // The helper being correct is not enough — these pin that the two
        // call sites use it, which is what actually regressed.
        it("isolates the day numbers in a same-month week header", () => {
            const header = dayRangeHeaderFormat({
                start: new Date("2026-09-05T00:00:00+03:00"),
                end: new Date("2026-09-11T00:00:00+03:00"),
            });
            expect(header).toContain("⁦");
            expect(header).toContain("⁩");
            expect(header).toContain("05 - 11");
        });

        it("isolates a cross-month range", () => {
            const header = dayRangeHeaderFormat({
                start: new Date("2026-09-28T00:00:00+03:00"),
                end: new Date("2026-10-04T00:00:00+03:00"),
            });
            expect(header).toContain("⁦");
            expect(header).toContain("⁩");
        });

        it("isolates the event tooltip time range", () => {
            expect(eventTimeRange("10:00", "12:00")).toBe("⁦10:00 - 12:00⁩");
        });
    });
});
