/**
 * Pure interval arithmetic for laying a continuous run of work around windows
 * it must not occupy ("jumping over" them). Deliberately domain-free —
 * everything is epoch milliseconds — so the same math backs the calendar
 * renderer, the drag preview and the gantt cut planner without any of them
 * re-deriving it.
 */

export type Interval = { start: number; end: number };

/**
 * Grid resolution of the calendar (minutes). A gap shorter than this can't be
 * rendered legibly, so the layout refuses to emit slivers that small.
 */
export const MIN_SEGMENT_MINUTES = 5;

const MINUTE_MS = 60_000;

export type LayoutOptions = {
    /**
     * Shortest piece worth drawing. A run of free time shorter than this is
     * skipped over rather than emitted as an unreadable sliver — the working
     * time it would have carried is deferred to the next piece, so the total
     * is unaffected.
     */
    minSegmentMs?: number;
};

/**
 * Sorts windows and merges every overlapping or touching pair, so downstream
 * walks can assume a strictly increasing, non-overlapping sequence. Empty and
 * inverted windows are dropped.
 */
export function normalizeWindows(windows: Iterable<Interval>): Array<Interval> {
    const sorted = [ ...windows ]
        .filter((w) => w.end > w.start)
        .sort((a, b) => a.start - b.start);

    const merged: Array<Interval> = [];
    for (const window of sorted) {
        const last = merged[ merged.length - 1 ];
        if (last && window.start <= last.end) {
            last.end = Math.max(last.end, window.end);
        } else {
            merged.push({ ...window });
        }
    }
    return merged;
}

/**
 * Lays `workingMs` of continuous work starting at `start`, stepping over every
 * window in its path.
 *
 * Invariants callers rely on:
 * - the returned segments are non-empty, ordered and non-overlapping;
 * - their lengths sum to exactly `workingMs` — the amount of work is never
 *   changed by the windows, only redistributed;
 * - a start that lands inside a window is pushed to that window's end.
 *
 * @param start Epoch ms the work begins at.
 * @param workingMs Net working length, excluding any window it steps over.
 * @param windows Blocked windows (any order; overlaps are fine).
 * @returns One segment per piece of the run — a single segment when nothing
 *          was in the way.
 * @example
 * ```typescript
 * // 4h of work from 09:00 over a 12:00-12:30 break → 09:00-12:00, 12:30-13:30
 * layoutAroundWindows(t("09:00"), 4 * 60 * 60_000, [breakWindow]);
 * ```
 */
export function layoutAroundWindows(
    start: number,
    workingMs: number,
    windows: Iterable<Interval>,
    options: LayoutOptions = {},
): Array<Interval> {
    const minSegmentMs = options.minSegmentMs ?? MIN_SEGMENT_MINUTES * MINUTE_MS;
    const merged = normalizeWindows(windows);

    let cursor = start;
    let remaining = Math.max(0, workingMs);
    const segments: Array<Interval> = [];

    for (const window of merged) {
        if (window.end <= cursor) continue; // already behind us
        if (remaining <= 0) break;
        if (window.start <= cursor) {
            // The run would begin inside this window — start after it instead.
            cursor = window.end;
            continue;
        }

        const available = window.start - cursor;
        if (available >= remaining) break; // the run finishes before this window

        if (available >= minSegmentMs) {
            segments.push({ start: cursor, end: window.start });
            remaining -= available;
        }
        // Otherwise the gap is too short to draw: skip it without consuming
        // any working time, which keeps the sum exact.
        cursor = window.end;
    }

    segments.push({ start: cursor, end: cursor + remaining });
    return segments;
}

/**
 * End of the last segment — i.e. the wall-clock instant the run finishes,
 * including every window it stepped over.
 */
export function layoutEnd(segments: ReadonlyArray<Interval>): number {
    return segments[ segments.length - 1 ].end;
}

/**
 * Inverse of {@link layoutAroundWindows}: how much *working* time a run
 * starting at `start` has consumed by the time the clock reaches `point`.
 * Window time is not work, so it doesn't count. Used to translate a resize
 * handle dropped anywhere on screen back into a net duration.
 *
 * @param start Epoch ms the run begins at.
 * @param point Epoch ms to measure up to.
 * @param windows Blocked windows (any order; overlaps are fine).
 * @returns Net working milliseconds in `[start, point]`; never negative.
 */
export function workingMsUpTo(
    start: number,
    point: number,
    windows: Iterable<Interval>,
    options: LayoutOptions = {},
): number {
    const minSegmentMs = options.minSegmentMs ?? MIN_SEGMENT_MINUTES * MINUTE_MS;
    const merged = normalizeWindows(windows);

    let cursor = start;
    let working = 0;

    for (const window of merged) {
        if (window.end <= cursor) continue;
        if (window.start >= point) break;
        if (window.start <= cursor) {
            cursor = window.end;
            continue;
        }

        const available = window.start - cursor;
        // Mirrors the sliver rule in `layoutAroundWindows` so the two stay
        // exact inverses of each other.
        if (available >= minSegmentMs) working += available;
        cursor = window.end;
    }

    if (point > cursor) working += point - cursor;
    return Math.max(0, working);
}
