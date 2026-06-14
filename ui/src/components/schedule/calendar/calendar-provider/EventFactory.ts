import dayjs from "dayjs";

import { Event, EventType } from "@/components/schedule/types/event";

export const createEventFactory = (
    eventPartial: Partial<Event>,
    isNewEvent: boolean,
): Event => {
    const type = eventPartial.type ?? EventType.EXERCISE;
    return {
        id: isNewEvent ? crypto.randomUUID() : (eventPartial.id as string),
        name: eventPartial.name ?? "",
        subject: eventPartial.subject ?? 0,
        hiveModule: eventPartial.hiveModule ?? 0,
        startTime: eventPartial.startTime ?? dayjs(),
        endTime: eventPartial.endTime ?? dayjs(),
        type,
        courses: eventPartial.courses ?? [],
        rooms: eventPartial.rooms ?? [],
        instructors: eventPartial.instructors ?? [],
        lecturers: type === EventType.LECTURE ? (eventPartial.lecturers ?? []) : [],
        tags: eventPartial.tags ?? [],
        notes: eventPartial.notes ?? "",
        locked: eventPartial.locked ?? false,
        required: eventPartial.required ?? false,
        hidden: eventPartial.hidden ?? false,
        personalTalk: eventPartial.personalTalk ?? false,
    };
};
