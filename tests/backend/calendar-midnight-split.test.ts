import { describe, expect, it } from "vitest";

import { collectBreakWindows } from "@/api-shared/break-windows";
import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
import { EventType } from "@/api-shared/types/event";
import {
    buildEventSegments,
    spansMultipleDays,
    splitAtDayBoundaries,
} from "@/components/schedule/calendar/split/segments";
import { Event } from "@/components/schedule/types/event";

/**
 * Regression tests for #650: dragging a long, break-split event to the
 * evening of another day pushed its wall-clock end past local midnight, and
 * react-big-calendar — which lays every piece out in exactly one day column
 * — silently dropped the whole event from the grid, with no error and no
 * trace in the data. Two independent layers guard against this now, and
 * each is exercised here:
 *
 * 1. `spansMultipleDays` (used by CalendarView's drag/resize commit) refuses
 *    to *create* a span crossing midnight in the first place.
 * 2. `buildEventSegments` (via `splitAtDayBoundaries`) is a last line of
 *    defence: any event that *already* has such a span — pre-fix data, an
 *    import, a direct API write — is cut at midnight into day-local pieces
 *    instead of being dropped, so the worst case is a visibly truncated
 *    block, never an invisible one.
 */

function localTime(date: string, time: string): Date {
    return dayjs.tz(`${date} ${time}`, "YYYY-MM-DD HH:mm", APP_TIMEZONE).toDate();
}

function makeEvent(overrides: Partial<Event> = {}): Event {
    return {
        id: "e1",
        name: "test event",
        subject: 1,
        hiveModule: 1,
        startTime: localTime("2026-09-09", "16:00") as unknown as Event["startTime"],
        endTime: localTime("2026-09-09", "18:00") as unknown as Event["endTime"],
        type: EventType.EXERCISE,
        courses: [],
        rooms: [],
        instructors: [],
        tags: [],
        notes: "",
        locked: false,
        hidden: false,
        required: false,
        personalTalk: false,
        splitAcrossBreaks: false,
        fake: false,
        ...overrides,
    } as Event;
}

function makeBreak(overrides: Partial<Event> = {}): Event {
    return makeEvent({
        id: "break1",
        type: EventType.BREAK,
        startTime: localTime("2026-09-09", "19:00") as unknown as Event["startTime"],
        endTime: localTime("2026-09-09", "19:30") as unknown as Event["endTime"],
        splitAcrossBreaks: false,
        ...overrides,
    });
}

function totalMs(segments: ReadonlyArray<{ from: dayjs.Dayjs; to: dayjs.Dayjs }>) {
    return segments.reduce((sum, s) => sum + (s.to.valueOf() - s.from.valueOf()), 0);
}

describe("splitAtDayBoundaries", () => {
    it("leaves a same-day span as a single chunk", () => {
        const start = localTime("2026-09-09", "16:00").valueOf();
        const end = localTime("2026-09-09", "18:00").valueOf();

        const chunks = splitAtDayBoundaries(start, end);

        expect(chunks).toHaveLength(1);
        expect(chunks[ 0 ].start).toEqual(new Date(start));
        expect(chunks[ 0 ].end).toEqual(new Date(end));
    });

    it("cuts a span that crosses one local midnight into two day-local chunks", () => {
        const start = localTime("2026-09-09", "22:00").valueOf();
        const end = localTime("2026-09-10", "02:00").valueOf();

        const chunks = splitAtDayBoundaries(start, end);

        expect(chunks).toHaveLength(2);
        expect(dayjs(chunks[ 0 ].start).tz(APP_TIMEZONE).format("YYYY-MM-DD HH:mm")).toBe(
            "2026-09-09 22:00",
        );
        expect(dayjs(chunks[ 0 ].end).tz(APP_TIMEZONE).format("YYYY-MM-DD HH:mm:ss")).toBe(
            "2026-09-09 23:59:59",
        );
        expect(dayjs(chunks[ 1 ].start).tz(APP_TIMEZONE).format("YYYY-MM-DD HH:mm:ss")).toBe(
            "2026-09-10 00:00:00",
        );
        expect(dayjs(chunks[ 1 ].end).tz(APP_TIMEZONE).format("YYYY-MM-DD HH:mm")).toBe(
            "2026-09-10 02:00",
        );
        // No work is lost or gained by the cut.
        const originalMs = end - start;
        const cutMs = chunks.reduce(
            (sum, c) => sum + (c.end.getTime() - c.start.getTime()),
            0,
        );
        expect(cutMs).toBe(originalMs - 1); // the shared midnight instant is counted once
    });

    it("cuts a multi-day span into one chunk per day", () => {
        const start = localTime("2026-09-09", "22:00").valueOf();
        const end = localTime("2026-09-12", "02:00").valueOf();

        const chunks = splitAtDayBoundaries(start, end);

        expect(chunks).toHaveLength(4); // 09→09, 10, 11, 12
    });

    it("treats an end that lands exactly on midnight as still same-day (no empty tail chunk)", () => {
        const start = localTime("2026-09-09", "22:00").valueOf();
        // dayjs' HH:mm parse of "00:00" the next day == the day boundary itself
        const end = localTime("2026-09-10", "00:00").valueOf();

        const chunks = splitAtDayBoundaries(start, end);

        // A single chunk (no dangling zero-length tail past midnight); it
        // ends at 23:59:59.999 of the start day rather than exactly at `end`
        // — a sub-millisecond rounding artifact of the day cut, not a bug a
        // human would ever notice on a minute-resolution calendar grid.
        expect(chunks).toHaveLength(1);
        expect(chunks[ 0 ].end.valueOf()).toBe(end - 1);
    });

    it("returns a single chunk for a zero-length span rather than nothing", () => {
        const instant = localTime("2026-09-09", "22:00").valueOf();

        const chunks = splitAtDayBoundaries(instant, instant);

        expect(chunks).toHaveLength(1);
        expect(chunks[ 0 ].start).toEqual(chunks[ 0 ].end);
    });
});

describe("spansMultipleDays", () => {
    it("is false for a same-day span", () => {
        expect(
            spansMultipleDays(
                localTime("2026-09-09", "16:00").valueOf(),
                localTime("2026-09-09", "18:00").valueOf(),
            ),
        ).toBe(false);
    });

    it("is true once the end crosses local midnight, even by one minute", () => {
        expect(
            spansMultipleDays(
                localTime("2026-09-09", "23:00").valueOf(),
                localTime("2026-09-10", "00:01").valueOf(),
            ),
        ).toBe(true);
    });

    it("is false when the end lands exactly on midnight", () => {
        expect(
            spansMultipleDays(
                localTime("2026-09-09", "22:00").valueOf(),
                localTime("2026-09-10", "00:00").valueOf(),
            ),
        ).toBe(false);
    });
});

describe("buildEventSegments — midnight-crossing events are never dropped (#650)", () => {
    it("a plain event that crosses midnight is drawn as two day-local segments, not lost", () => {
        const event = makeEvent({
            startTime: localTime("2026-09-09", "22:00") as unknown as Event["startTime"],
            endTime: localTime("2026-09-10", "02:00") as unknown as Event["endTime"],
            splitAcrossBreaks: false,
        });

        const segments = buildEventSegments([ event ], []);

        expect(segments).not.toHaveLength(0);
        expect(segments).toHaveLength(2);
        expect(segments.every((s) => s.event.id === event.id)).toBe(true);
        expect(segments[ 0 ].to.isBefore(segments[ 1 ].from) || segments[ 0 ].to.isSame(segments[ 1 ].from)).toBe(true);
    });

    it("the exact reported scenario — long break-split event dragged past midnight — stays visible", () => {
        // Mirrors the real corrupted record found in production: a
        // split-across-breaks event whose net working span, laid out around
        // a dinner break, ends after local midnight.
        const theBreak = makeBreak({
            startTime: localTime("2026-09-09", "19:00") as unknown as Event["startTime"],
            endTime: localTime("2026-09-09", "19:30") as unknown as Event["endTime"],
        });
        const event = makeEvent({
            id: "long-event",
            name: 'איפוס חד"ס',
            startTime: localTime("2026-09-09", "16:00") as unknown as Event["startTime"],
            endTime: localTime("2026-09-10", "00:30") as unknown as Event["endTime"], // 8h net, crosses midnight
            splitAcrossBreaks: true,
        });

        const windows = collectBreakWindows([ theBreak, event ]);
        const segments = buildEventSegments([ theBreak, event ], windows);
        const eventSegments = segments.filter((s) => s.event.id === "long-event");

        // The bug's signature: the event must not vanish entirely.
        expect(eventSegments.length).toBeGreaterThan(0);
        // Every segment stays within a single calendar day — the property
        // react-big-calendar's per-day layout actually requires.
        for (const segment of eventSegments) {
            expect(
                segment.from.tz(APP_TIMEZONE).isSame(segment.to.tz(APP_TIMEZONE), "day"),
            ).toBe(true);
        }
        // No working time is silently lost across the day cut: the drawn
        // segments still account for (within a sub-millisecond rounding at
        // the exact day boundary) the event's full net working span.
        const workingMs =
            (event.endTime as unknown as Date).valueOf() -
            (event.startTime as unknown as Date).valueOf();
        expect(totalMs(eventSegments)).toBeGreaterThan(workingMs - 5);
        expect(totalMs(eventSegments)).toBeLessThanOrEqual(workingMs);
    });

    it("an event fully within one day is unaffected (still a single segment)", () => {
        const event = makeEvent({
            startTime: localTime("2026-09-09", "16:00") as unknown as Event["startTime"],
            endTime: localTime("2026-09-09", "18:00") as unknown as Event["endTime"],
        });

        const segments = buildEventSegments([ event ], []);

        expect(segments).toHaveLength(1);
    });

    it("a break-split event that stays within one day is unaffected by the day-boundary cut", () => {
        const theBreak = makeBreak();
        const event = makeEvent({
            startTime: localTime("2026-09-09", "16:00") as unknown as Event["startTime"],
            endTime: localTime("2026-09-09", "20:30") as unknown as Event["endTime"], // steps over the 19:00-19:30 break
            splitAcrossBreaks: true,
        });

        const segments = buildEventSegments(
            [ theBreak, event ],
            collectBreakWindows([ theBreak, event ]),
        ).filter((s) => s.event.id === event.id);

        expect(segments).toHaveLength(2); // one break stepped over → two pieces
        for (const segment of segments) {
            expect(segment.from.tz(APP_TIMEZONE).isSame(segment.to.tz(APP_TIMEZONE), "day")).toBe(
                true,
            );
        }
    });
});
