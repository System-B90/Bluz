import { isInstructorBusy } from "@/components/base/CalendarFilterProvider";
import { PersonField } from "@/components/schedule/calendar/instructor-dnd/types";
import {
    Event,
    eventHasLecturers,
    PersonId,
} from "@/components/schedule/types/event";

/** The placeholder id standing for "somebody external", not a named person. */
const GENERIC_OUTSIDER = "איש חוץ";

/**
 * Resolves which person field a drop writes into.
 * @param event The drop target event.
 * @param withModifier Whether Shift was held at drop time.
 * @param sourceField The field the person was dragged out of, when the drag
 * started on a chip already sitting in an event. A move keeps the person's
 * role: dragging a lecturer without Shift used to silently demote them to an
 * instructor on the target (#628).
 * @returns `lecturers` when the modifier is held or the person already was a
 * lecturer, and the event type actually carries lecturers; `instructors`
 * otherwise.
 */
export function targetFieldFor(
    event: Event,
    withModifier: boolean,
    sourceField?: PersonField,
): PersonField {
    const wantsLecturers = withModifier || sourceField === "lecturers";
    return wantsLecturers && eventHasLecturers(event.type)
        ? "lecturers"
        : "instructors";
}

/**
 * Why a chip dragged from one event to another cannot make the trip, or the
 * field it lands in when it can.
 *
 * A move is two writes, and both have to be possible before either happens:
 * the source giving the person up, and the target taking them. Deciding that
 * up front is what stops a person being dropped from the source and added
 * nowhere (#625), or added to the target while a locked source keeps them
 * (#626).
 */
export type PersonMovePlan =
    | { allowed: false; reason: "locked-source" | "target-cannot-hold" }
    | { allowed: true; field: PersonField };

/**
 * Decides whether a person can move between two events, and into which field.
 * @param source The event the chip was dragged out of.
 * @param target The event it was dropped on.
 * @param personId The person being moved.
 * @param withModifier Whether Shift was held at drop time.
 * @param sourceField The field the chip sat in on the source event.
 */
export function planPersonMove(
    source: Event | undefined,
    target: Event,
    personId: PersonId,
    withModifier: boolean,
    sourceField?: PersonField,
): PersonMovePlan {
    if (source?.locked) return { allowed: false, reason: "locked-source" };

    const field = targetFieldFor(target, withModifier, sourceField);
    // `instructors` holds Hive ids only, so an outsider dropped there has
    // nowhere to go on the target.
    if (field === "instructors" && typeof personId !== "number") {
        return { allowed: false, reason: "target-cannot-hold" };
    }

    return { allowed: true, field };
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
 * @param excludeEventIds Events to leave out of the scan besides the target.
 * A move runs the target assign before the source unassign, so without this
 * the source event itself — still holding the person in state — reported as
 * a conflict on every move between overlapping events.
 * @returns Overlapping events the person is already busy in.
 */
export function findPersonConflicts(
    events: Array<Event>,
    personId: PersonId,
    target: Event,
    excludeEventIds: ReadonlyArray<Event["id"]> = [],
): Array<Event> {
    // "איש חוץ" is a generic placeholder rather than one person, so two events
    // carrying it are not the same body double-booked.
    if (personId === GENERIC_OUTSIDER) return [];

    // Named outsiders live in `lecturers` only, so they need their own
    // presence test — bailing on every non-number meant they never produced an
    // overlap warning at all (#627).
    const isBusy = (candidate: Event): boolean =>
        typeof personId === "number"
            ? isInstructorBusy(personId, candidate)
            : (candidate.lecturers?.includes(personId) ?? false);

    return events.filter(
        (candidate) =>
            candidate.id !== target.id &&
            !excludeEventIds.includes(candidate.id) &&
            isBusy(candidate) &&
            candidate.startTime.isBefore(target.endTime) &&
            target.startTime.isBefore(candidate.endTime),
    );
}
