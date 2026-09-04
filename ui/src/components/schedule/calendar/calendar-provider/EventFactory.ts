import dayjs from "dayjs";

import
{
    defaultSplitAcrossBreaks,
    Event,
    eventHasLecturers,
    EventType,
} from "@/components/schedule/types/event";

export const createEventFactory = (
    eventPartial: Partial<Event>,
    isNewEvent: boolean,
): Event =>
{
    const type = eventPartial.type ?? EventType.EXERCISE;
    return {
        id: isNewEvent ? crypto.randomUUID() : (eventPartial.id as string),
        name: eventPartial.name ?? "",
        subject: eventPartial.subject ?? 0,
        hiveModule: eventPartial.hiveModule ?? 0,
        hiveLesson: eventPartial.hiveLesson ?? null,
        startTime: eventPartial.startTime ?? dayjs(),
        endTime: eventPartial.endTime ?? dayjs(),
        type,
        courses: eventPartial.courses ?? [],
        rooms: eventPartial.rooms ?? [],
        instructors: eventPartial.instructors ?? [],
        lecturers: eventHasLecturers(type)
            ? (eventPartial.lecturers ?? [])
            : [],
        tags: eventPartial.tags ?? [],
        notes: eventPartial.notes ?? "",
        locked: eventPartial.locked ?? false,
        required: eventPartial.required ?? false,
        hidden: eventPartial.hidden ?? false,
        personalTalk: eventPartial.personalTalk ?? false,
        splitAcrossBreaks:
            eventPartial.splitAcrossBreaks ?? defaultSplitAcrossBreaks(type),
        fake: eventPartial.fake ?? false,
        color: eventPartial.color,
        hiveQueues: eventPartial.hiveQueues,
        // Provenance/disambiguation fields the gantt cut stamps on an event —
        // must survive every save (drag, resize, dialog edit) or the event
        // silently disowns the gantt occurrence it was cut from (#…).
        ganttEventId: eventPartial.ganttEventId,
        ganttOccurrenceDate: eventPartial.ganttOccurrenceDate,
        ganttCurriculumId: eventPartial.ganttCurriculumId,
    };
};
