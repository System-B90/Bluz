import { Event, EventId, PersonId } from "@/components/schedule/types/event";

/**
 * Field of an {@link Event} a dropped person is written into. Plain drops write
 * `instructors` (מבוזרים); holding Shift while dropping writes `lecturers`
 * (מרצים/מנהלים) for the event types that carry that field.
 */
export type PersonField = "instructors" | "lecturers";

/**
 * Payload carried by a drag that started in the instructor rail.
 */
export type PaletteDragData = {
    kind: "palette-instructor";
    personId: number;
};

/**
 * Payload carried by a drag that started on a person chip rendered inside an
 * event — dragging it away is the unassign gesture.
 */
export type EventPersonDragData = {
    kind: "event-person";
    personId: PersonId;
    eventId: EventId;
};

export type InstructorDragData = EventPersonDragData | PaletteDragData;

export const UNASSIGN_DROPPABLE_ID = "instructor-unassign-zone";

export function paletteDraggableId(
    personId: number,
    groupKey: string,
): string {
    return `palette-instructor:${groupKey}:${personId}`;
}

export function eventPersonDraggableId(
    eventId: EventId,
    personId: PersonId,
): string {
    return `event-person:${eventId}:${personId}`;
}

export function eventDroppableId(eventId: EventId): string {
    return `event-drop:${eventId}`;
}

/**
 * Narrows an unknown dnd-kit `data.current` blob to our drag payload.
 */
export function asInstructorDragData(
    data: unknown,
): InstructorDragData | undefined {
    const kind = (data as null | Partial<InstructorDragData>)?.kind;
    return kind === "palette-instructor" || kind === "event-person"
        ? (data as InstructorDragData)
        : undefined;
}

export type EventDropData = {
    kind: "event";
    event: Event;
};
