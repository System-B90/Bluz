import { isInstructorBusy } from "@/components/base/CalendarFilterProvider";
import { PersonField } from "@/components/schedule/calendar/instructor-dnd/types";
import {
    Event,
    eventHasLecturers,
    PersonId,
} from "@/components/schedule/types/event";

/**
 * Resolves which person field a drop writes into.
 * @param event The drop target event.
 * @param withModifier Whether Shift was held at drop time.
 * @returns `lecturers` only when the modifier is held and the event type
 * actually carries lecturers; `instructors` otherwise.
 */
export function targetFieldFor(
    event: Event,
    withModifier: boolean,
): PersonField {
    return withModifier && eventHasLecturers(event.type)
        ? "lecturers"
        : "instructors";
}

/**
 * Adds a person to one of an event's person fields.
 * @param event The event to update.
 * @param personId The person being assigned.
 * @param field The field to write into.
 * @returns An updated event copy, or `null` when the person already holds that
 * exact role on the event (nothing to save).
 */
export function withPersonAdded(
    event: Event,
    personId: PersonId,
    field: PersonField,
): Event | null {
    if (field === "lecturers") {
        if (event.lecturers?.includes(personId)) return null;
        return { ...event, lecturers: [...(event.lecturers ?? []), personId] };
    }

    if (typeof personId !== "number") return null;
    if (event.instructors.includes(personId)) return null;
    return { ...event, instructors: [...event.instructors, personId] };
}

/**
 * Removes a person from both person fields of an event.
 * @param event The event to update.
 * @param personId The person being unassigned.
 * @returns An updated event copy, or `null` when the person was not on the
 * event to begin with.
 */
export function withPersonRemoved(
    event: Event,
    personId: PersonId,
): Event | null {
    const instructors = event.instructors.filter((id) => id !== personId);
    const lecturers = event.lecturers?.filter((id) => id !== personId);

    const changed =
        instructors.length !== event.instructors.length ||
        (lecturers?.length ?? 0) !== (event.lecturers?.length ?? 0);
    if (!changed) return null;

    return {
        ...event,
        instructors,
        ...(event.lecturers ? { lecturers } : {}),
    };
}

/**
 * Finds events that already book a person during the target event's slot —
 * the same overlap report the curriculum cut pipeline surfaces.
 * @param events All events currently in state.
 * @param personId The person being assigned.
 * @param target The event being dropped onto.
 * @returns Overlapping events the person is already busy in.
 */
export function findPersonConflicts(
    events: Array<Event>,
    personId: PersonId,
    target: Event,
): Array<Event> {
    if (typeof personId !== "number") return [];

    return events.filter(
        (candidate) =>
            candidate.id !== target.id &&
            isInstructorBusy(personId, candidate) &&
            candidate.startTime.isBefore(target.endTime) &&
            target.startTime.isBefore(candidate.endTime),
    );
}
