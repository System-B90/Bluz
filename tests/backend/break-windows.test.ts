import { describe, expect, it } from "vitest";

import {
    breakAppliesTo,
    breakWindowsFor,
    collectBreakWindows,
    splitEventAcrossBreaks,
    SplittableEvent,
    workingMsOf,
} from "@/api-shared/break-windows";
import { Interval } from "@/api-shared/interval-layout";
import { EventType } from "@/api-shared/types/event";
import { RoomSource } from "@/api-shared/types/room";

const MINUTE = 60_000;

function t(clock: string): Date {
    return new Date(`2026-01-01T${clock}:00`);
}

function makeEvent(overrides: Partial<SplittableEvent> = {}): SplittableEvent {
    return {
        type: EventType.EXERCISE,
        startTime: t("12:15"),
        endTime: t("13:45"), // 90 working minutes
        rooms: [],
        courses: [],
        splitAcrossBreaks: true,
        ...overrides,
    };
}

function makeBreak(overrides: Partial<SplittableEvent> = {}): SplittableEvent {
    return makeEvent({
        type: EventType.BREAK,
        startTime: t("13:00"),
        endTime: t("13:30"),
        splitAcrossBreaks: false,
        ...overrides,
    });
}

function readable(segments: Array<Interval>): Array<string> {
    return segments.map(
        (segment) =>
            `${new Date(segment.start).toTimeString().slice(0, 5)}-${new Date(segment.end).toTimeString().slice(0, 5)}`,
    );
}

const ROOM_A = { id: 1, source: RoomSource.Hive } as const;
const ROOM_B = { id: 2, source: RoomSource.Hive } as const;

describe("collectBreakWindows", () => {
    it("picks up only break events, with their scope", () => {
        const windows = collectBreakWindows([
            makeEvent(),
            makeBreak({ rooms: [ ROOM_A ], courses: [ "c1" ] }),
        ]);

        expect(windows).toHaveLength(1);
        expect(windows[0].start).toBe(t("13:00").getTime());
        expect(windows[0].roomKeys).toEqual([ `${RoomSource.Hive}:1` ]);
        expect(windows[0].courseIds).toEqual([ "c1" ]);
    });
});

describe("breakAppliesTo", () => {
    const [ unscoped ] = collectBreakWindows([ makeBreak() ]);
    const [ roomScoped ] = collectBreakWindows([ makeBreak({ rooms: [ ROOM_A ] }) ]);
    const [ courseScoped ] = collectBreakWindows([ makeBreak({ courses: [ "c1" ] }) ]);

    it("treats a break with no rooms and no courses as base-wide", () => {
        expect(breakAppliesTo(unscoped, makeEvent())).toBe(true);
        expect(breakAppliesTo(unscoped, makeEvent({ rooms: [ ROOM_B ] }))).toBe(true);
    });

    it("reaches an event sharing a room", () => {
        expect(breakAppliesTo(roomScoped, makeEvent({ rooms: [ ROOM_A ] }))).toBe(true);
        expect(breakAppliesTo(roomScoped, makeEvent({ rooms: [ ROOM_B ] }))).toBe(false);
        expect(breakAppliesTo(roomScoped, makeEvent())).toBe(false);
    });

    it("reaches an event sharing a course", () => {
        expect(breakAppliesTo(courseScoped, makeEvent({ courses: [ "c1" ] }))).toBe(true);
        expect(breakAppliesTo(courseScoped, makeEvent({ courses: [ "c2" ] }))).toBe(false);
    });
});

describe("breakWindowsFor", () => {
    const windows = collectBreakWindows([ makeBreak() ]);

    it("is empty when the event doesn't split", () => {
        expect(breakWindowsFor(makeEvent({ splitAcrossBreaks: false }), windows)).toEqual([]);
    });

    it("is empty for a break event, so breaks never split over each other", () => {
        expect(
            breakWindowsFor(makeBreak({ splitAcrossBreaks: true }), windows),
        ).toEqual([]);
    });
});

describe("splitEventAcrossBreaks", () => {
    it("draws a split-enabled event in pieces around the break it meets", () => {
        const windows = collectBreakWindows([ makeBreak() ]);

        expect(readable(splitEventAcrossBreaks(makeEvent(), windows))).toEqual([
            "12:15-13:00",
            "13:30-14:15",
        ]);
    });

    it("never changes the event's working duration", () => {
        const event = makeEvent();
        const windows = collectBreakWindows([
            makeBreak(),
            makeBreak({ startTime: t("12:30"), endTime: t("12:40") }),
        ]);

        const drawn = splitEventAcrossBreaks(event, windows);
        const total = drawn.reduce((sum, piece) => sum + (piece.end - piece.start), 0);

        expect(total).toBe(workingMsOf(event));
        expect(total).toBe(90 * MINUTE);
    });

    it("draws a single piece when the flag is off, overlapping the break", () => {
        const windows = collectBreakWindows([ makeBreak() ]);
        const event = makeEvent({ splitAcrossBreaks: false });

        expect(readable(splitEventAcrossBreaks(event, windows))).toEqual([
            "12:15-13:45",
        ]);
    });

    it("ignores a break scoped to a room the event isn't in", () => {
        const windows = collectBreakWindows([ makeBreak({ rooms: [ ROOM_A ] }) ]);
        const event = makeEvent({ rooms: [ ROOM_B ] });

        expect(readable(splitEventAcrossBreaks(event, windows))).toEqual([
            "12:15-13:45",
        ]);
    });
});
