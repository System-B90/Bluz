import { Interval, layoutAroundWindows, LayoutOptions } from "@/api-shared/interval-layout";
import { CourseId } from "@/api-shared/types/course";
import { EventType } from "@/api-shared/types/event";
import { ResolvableRoom, roomLikeToResourceKey } from "@/api-shared/types/room";

/**
 * Turns break (הפסקה) events into the windows that split-enabled events jump
 * over, and decides which of those windows apply to which event.
 *
 * Splitting is a *layout* concern only: an event's stored `startTime`/`endTime`
 * always describe its net working span, and nothing here ever writes. Move a
 * break and every affected event simply re-lays-out on the next render — its
 * duration cannot change as a side effect of another event moving.
 */

/** Anything with a wall-clock instant — `Date` on the server, `Dayjs` on the client. */
type Instant = { valueOf: () => number };

/** The subset of an event this module needs, in either representation. */
export type SplittableEvent = {
    type: EventType;
    startTime: Instant;
    endTime: Instant;
    rooms: ReadonlyArray<ResolvableRoom>;
    courses: ReadonlyArray<CourseId>;
    splitAcrossBreaks: boolean;
};

/** A break window plus the audience it applies to. */
export type BreakWindow = Interval & {
    /** Resource keys of the break's rooms; empty means "not room-scoped". */
    roomKeys: ReadonlyArray<string>;
    /** The break's courses; empty means "not course-scoped". */
    courseIds: ReadonlyArray<CourseId>;
};

export function isBreakEvent(event: Pick<SplittableEvent, "type">): boolean {
    return event.type === EventType.BREAK;
}

/**
 * Net working length of an event. `endTime` is a derivative of `startTime` and
 * this duration — it is never inflated by the breaks the event steps over.
 */
export function workingMsOf(event: Pick<SplittableEvent, "endTime" | "startTime">): number {
    return Math.max(0, event.endTime.valueOf() - event.startTime.valueOf());
}

/**
 * Extracts every break event in `events` as a scoped window. Pass the complete
 * event set, not a filtered/visible subset — a break hidden by a filter still
 * interrupts the day.
 */
export function collectBreakWindows(
    events: Iterable<SplittableEvent>,
): Array<BreakWindow> {
    const windows: Array<BreakWindow> = [];
    for (const event of events) {
        if (!isBreakEvent(event)) continue;
        windows.push({
            start: event.startTime.valueOf(),
            end: event.endTime.valueOf(),
            roomKeys: event.rooms.map((room) => roomLikeToResourceKey(room)),
            courseIds: [ ...event.courses ],
        });
    }
    return windows;
}

/**
 * Whether a break interrupts a given event. A break with no rooms and no
 * courses is base-wide and interrupts everyone; a scoped break only reaches
 * events it shares a room or a course with.
 */
export function breakAppliesTo(
    window: BreakWindow,
    event: Pick<SplittableEvent, "courses" | "rooms">,
): boolean {
    if (window.roomKeys.length === 0 && window.courseIds.length === 0) return true;

    const sharesRoom = event.rooms.some((room) =>
        window.roomKeys.includes(roomLikeToResourceKey(room)),
    );
    if (sharesRoom) return true;

    return event.courses.some((course) => window.courseIds.includes(course));
}

/**
 * The windows that actually interrupt `event`: scoped to its audience, and
 * empty whenever the event doesn't split at all (flag off, or a break event
 * itself — breaks never split over each other).
 */
export function breakWindowsFor(
    event: SplittableEvent,
    windows: ReadonlyArray<BreakWindow>,
): Array<Interval> {
    if (!event.splitAcrossBreaks || isBreakEvent(event)) return [];
    return windows.filter((window) => breakAppliesTo(window, event));
}

/**
 * Lays an event out across the breaks that interrupt it.
 *
 * @param event The event to lay out.
 * @param windows All break windows in play (see {@link collectBreakWindows}).
 * @returns One or more segments covering the event's working time; always
 *          exactly one segment for a non-splitting event.
 */
export function splitEventAcrossBreaks(
    event: SplittableEvent,
    windows: ReadonlyArray<BreakWindow>,
    options?: LayoutOptions,
): Array<Interval> {
    return layoutAroundWindows(
        event.startTime.valueOf(),
        workingMsOf(event),
        breakWindowsFor(event, windows),
        options,
    );
}
