import dayjs from "dayjs";

import { CourseId } from "@/api-shared/types/course";
import { areRoomsEqual, ResolvableRoom } from "@/api-shared/types/room";
import { Event } from "@/components/schedule/types/event";
import { copyableFields } from "@/components/schedule/types/EventUtils";

/** How many days "דחייה בשבוע" moves an event. */
const POSTPONE_DAYS = 7;

/**
 * Whether a marker is on for none, some or all of the targets. A bulk toggle
 * is only "on" when every target carries it, so one click over a mixed
 * selection turns the marker on everywhere rather than flipping each event
 * to the opposite of whatever it happened to be.
 */
export type TriState = "all" | "none" | "some";

/**
 * Folds a per-event predicate over the targets.
 * @param events The events the menu is acting on.
 * @param has Reads the marker off one event.
 * @returns Whether none, some or all of them carry it.
 */
export function triStateOf(
    events: ReadonlyArray<Event>,
    has: (event: Event) => boolean,
): TriState {
    if (events.length === 0) return "none";
    const hits = events.filter(has).length;
    if (hits === 0) return "none";
    return hits === events.length ? "all" : "some";
}

/**
 * The same event a week later. Only the times move — duration, rooms and
 * every marker are preserved, so a postponed event is the event it was.
 * @param event The event to move.
 * @returns The postponed copy.
 */
export function postponedByAWeek(event: Event): Event {
    return {
        ...event,
        startTime: dayjs(event.startTime).add(POSTPONE_DAYS, "day"),
        endTime: dayjs(event.endTime).add(POSTPONE_DAYS, "day"),
    };
}

/**
 * A brand-new event seeded from an existing one, in the same slot. The grid
 * lays the two side by side, which is what makes the copy visible without
 * guessing at a free slot to drop it into — the user then drags it where it
 * belongs (or undoes).
 * @param event The event to copy.
 * @returns The new event, ready to save (the provider assigns its id).
 */
export function duplicateOf(event: Event): Event {
    return { ...copyableFields(event) } as Event;
}

/**
 * Adds or removes one shuffle (מסלול) from an event, leaving its other
 * shuffles alone. Order is preserved on removal so the event's course list
 * doesn't reshuffle itself under the user on every toggle.
 * @param event The event to change.
 * @param courseId The shuffle being toggled.
 * @param member Whether the event should end up in that shuffle.
 * @returns The updated event.
 */
export function withCourseMembership(
    event: Event,
    courseId: CourseId,
    member: boolean,
): Event {
    const has = event.courses.includes(courseId);
    if (has === member) return event;
    return {
        ...event,
        courses: member
            ? [...event.courses, courseId]
            : event.courses.filter((id) => id !== courseId),
    };
}

/**
 * Reassigns the event to exactly one room, or clears its rooms entirely.
 * "Reassign" replaces rather than adds: an event dragged between room columns
 * behaves the same way, and a menu that only ever appended would give no way
 * back out of a wrong room without opening the dialog.
 * @param event The event to change.
 * @param room The room to move it to, or null to leave it roomless.
 * @returns The updated event.
 */
export function reassignedToRoom(
    event: Event,
    room: null | ResolvableRoom,
): Event {
    if (!room) return { ...event, rooms: [] };
    if (event.rooms.length === 1 && areRoomsEqual(event.rooms[0], room)) {
        return event;
    }
    return { ...event, rooms: [room] };
}

/**
 * Reassigns the event to exactly one instructor, or clears its instructors.
 * Replaces for the same reason {@link reassignedToRoom} does. `lecturers` is
 * filtered down to whoever is still on the event, so a lecture cannot keep
 * naming a lecturer who is no longer assigned to it.
 * @param event The event to change.
 * @param instructorId The instructor to move it to, or null to leave it unstaffed.
 * @returns The updated event.
 */
export function reassignedToInstructor(
    event: Event,
    instructorId: null | number,
): Event {
    const instructors = instructorId === null ? [] : [instructorId];
    if (
        event.instructors.length === instructors.length &&
        event.instructors.every((id, index) => id === instructors[index])
    ) {
        return event;
    }
    const lecturers = Array.isArray(event.lecturers)
        ? event.lecturers.filter(
            (person) => typeof person !== "number" || instructors.includes(person),
        )
        : event.lecturers;
    return { ...event, instructors, lecturers };
}
