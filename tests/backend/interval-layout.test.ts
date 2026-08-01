import { describe, expect, it } from "vitest";

import {
    Interval,
    layoutAroundWindows,
    layoutEnd,
    MIN_SEGMENT_MINUTES,
    normalizeWindows,
    workingMsUpTo,
} from "@/api-shared/interval-layout";

const MINUTE = 60_000;

/** `2026-01-01T<hh:mm>` as epoch ms. */
function t(clock: string): number {
    return new Date(`2026-01-01T${clock}:00`).getTime();
}

function window(from: string, to: string): Interval {
    return { start: t(from), end: t(to) };
}

/** Segments as `["09:00-12:00", ...]`, for readable assertions. */
function readable(segments: Array<Interval>): Array<string> {
    return segments.map(
        (segment) =>
            `${new Date(segment.start).toTimeString().slice(0, 5)}-${new Date(segment.end).toTimeString().slice(0, 5)}`,
    );
}

function totalMs(segments: Array<Interval>): number {
    return segments.reduce((sum, s) => sum + (s.end - s.start), 0);
}

describe("normalizeWindows", () => {
    it("sorts, merges overlapping and touching windows, and drops empty ones", () => {
        const merged = normalizeWindows([
            window("13:00", "13:30"),
            window("09:00", "09:00"), // empty
            window("13:30", "14:00"), // touches the first
            window("10:00", "11:00"),
            window("10:30", "10:45"), // contained
        ]);

        expect(readable(merged)).toEqual([ "10:00-11:00", "13:00-14:00" ]);
    });
});

describe("layoutAroundWindows", () => {
    it("returns a single segment when nothing is in the way", () => {
        const segments = layoutAroundWindows(t("08:00"), 60 * MINUTE, [
            window("13:00", "13:30"),
        ]);

        expect(readable(segments)).toEqual([ "08:00-09:00" ]);
    });

    it("steps over a window it runs into, preserving the working length", () => {
        const segments = layoutAroundWindows(t("12:15"), 90 * MINUTE, [
            window("13:00", "13:30"),
        ]);

        expect(readable(segments)).toEqual([ "12:15-13:00", "13:30-14:15" ]);
        expect(totalMs(segments)).toBe(90 * MINUTE);
    });

    it("splits into as many pieces as there are windows in its path", () => {
        const segments = layoutAroundWindows(t("07:00"), 10 * 60 * MINUTE, [
            window("09:00", "09:30"),
            window("13:00", "14:00"),
            window("18:00", "18:45"),
        ]);

        expect(readable(segments)).toEqual([
            "07:00-09:00",
            "09:30-13:00",
            "14:00-18:00",
            "18:45-19:15",
        ]);
        expect(totalMs(segments)).toBe(10 * 60 * MINUTE);
    });

    it("starts after a window it would have begun inside", () => {
        const segments = layoutAroundWindows(t("13:10"), 60 * MINUTE, [
            window("13:00", "13:30"),
        ]);

        expect(readable(segments)).toEqual([ "13:30-14:30" ]);
        expect(totalMs(segments)).toBe(60 * MINUTE);
    });

    it("skips a gap too short to draw rather than emitting a sliver", () => {
        // Only 3 minutes fit before the window — below the grid resolution.
        const segments = layoutAroundWindows(t("12:57"), 60 * MINUTE, [
            window("13:00", "13:30"),
        ]);

        expect(readable(segments)).toEqual([ "13:30-14:30" ]);
        // The skipped time is not lost: the full duration still lands.
        expect(totalMs(segments)).toBe(60 * MINUTE);
    });

    it("keeps a gap exactly at the minimum size", () => {
        const start = t("13:00") - MIN_SEGMENT_MINUTES * MINUTE;
        const segments = layoutAroundWindows(start, 60 * MINUTE, [
            window("13:00", "13:30"),
        ]);

        expect(readable(segments)).toEqual([ "12:55-13:00", "13:30-14:25" ]);
        expect(totalMs(segments)).toBe(60 * MINUTE);
    });

    it("ignores windows behind the start and beyond the end", () => {
        const segments = layoutAroundWindows(t("10:00"), 60 * MINUTE, [
            window("08:00", "09:00"),
            window("13:00", "13:30"),
        ]);

        expect(readable(segments)).toEqual([ "10:00-11:00" ]);
    });

    it("reports the drawn end, which runs past the working end", () => {
        const segments = layoutAroundWindows(t("12:15"), 90 * MINUTE, [
            window("13:00", "13:30"),
        ]);

        expect(layoutEnd(segments)).toBe(t("14:15"));
    });
});

describe("workingMsUpTo", () => {
    it("is the exact inverse of the layout", () => {
        const windows = [ window("09:00", "09:30"), window("13:00", "14:00") ];
        const segments = layoutAroundWindows(t("07:00"), 5 * 60 * MINUTE, windows);

        expect(workingMsUpTo(t("07:00"), layoutEnd(segments), windows)).toBe(
            5 * 60 * MINUTE,
        );
    });

    it("does not count time spent inside a window", () => {
        const windows = [ window("13:00", "13:30") ];

        expect(workingMsUpTo(t("12:00"), t("14:00"), windows)).toBe(90 * MINUTE);
    });

    it("clamps to the window start when the point falls inside a window", () => {
        const windows = [ window("13:00", "13:30") ];

        expect(workingMsUpTo(t("12:00"), t("13:15"), windows)).toBe(60 * MINUTE);
    });

    it("is zero for a point at or before the start", () => {
        expect(workingMsUpTo(t("12:00"), t("11:00"), [])).toBe(0);
    });
});
