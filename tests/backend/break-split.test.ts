import { describe, expect, it } from "vitest";

import { extendEndPastBreaks } from "@/api-shared/break-split";

describe("extendEndPastBreaks", () => {
    it("leaves the end untouched when there's no overlapping break", () => {
        const start = new Date("2026-01-01T08:00:00");
        const end = new Date("2026-01-01T09:00:00");
        const result = extendEndPastBreaks(start, end, [
            { start: new Date("2026-01-01T13:00:00"), end: new Date("2026-01-01T13:30:00") },
        ]);
        expect(result).toEqual(end);
    });

    it("extends the end by the break's length when the event overlaps it", () => {
        const start = new Date("2026-01-01T12:15:00");
        const end = new Date("2026-01-01T13:45:00"); // 90 minutes
        const result = extendEndPastBreaks(start, end, [
            { start: new Date("2026-01-01T13:00:00"), end: new Date("2026-01-01T13:30:00") },
        ]);
        expect(result).toEqual(new Date("2026-01-01T14:15:00"));
    });

    it("never moves the start, only the end", () => {
        const start = new Date("2026-01-01T12:15:00");
        const end = new Date("2026-01-01T13:45:00");
        const result = extendEndPastBreaks(start, end, [
            { start: new Date("2026-01-01T13:00:00"), end: new Date("2026-01-01T13:30:00") },
        ]);
        expect(result.getTime()).toBeGreaterThan(start.getTime());
    });

    it("stacks extensions across multiple overlapping breaks", () => {
        const start = new Date("2026-01-01T07:00:00");
        const end = new Date("2026-01-01T14:00:00"); // spans breakfast, lunch, dinner
        const result = extendEndPastBreaks(start, end, [
            { start: new Date("2026-01-01T07:00:00"), end: new Date("2026-01-01T07:35:00") },
            { start: new Date("2026-01-01T13:00:00"), end: new Date("2026-01-01T14:30:00") },
        ]);
        // +35m (breakfast) + 90m (lunch) = +125m past the original 14:00 end.
        expect(result).toEqual(new Date("2026-01-01T16:05:00"));
    });

    it("ignores a break that ends before the event starts", () => {
        const start = new Date("2026-01-01T14:00:00");
        const end = new Date("2026-01-01T15:00:00");
        const result = extendEndPastBreaks(start, end, [
            { start: new Date("2026-01-01T13:00:00"), end: new Date("2026-01-01T13:30:00") },
        ]);
        expect(result).toEqual(end);
    });

    it("ignores a break that starts after the event ends", () => {
        const start = new Date("2026-01-01T08:00:00");
        const end = new Date("2026-01-01T09:00:00");
        const result = extendEndPastBreaks(start, end, [
            { start: new Date("2026-01-01T13:00:00"), end: new Date("2026-01-01T13:30:00") },
        ]);
        expect(result).toEqual(end);
    });
});
