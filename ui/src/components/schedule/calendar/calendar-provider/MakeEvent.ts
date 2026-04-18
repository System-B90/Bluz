import dayjs from 'dayjs';

import { Event, EventType } from '@/components/schedule/types/event';

export function makeEvent(partial?: Partial<Event>): Event
{
    return {
        id: partial?.id ?? crypto.randomUUID(),
        name: partial?.name ?? '',
        subject: partial?.subject ?? 0,
        hiveModule: partial?.hiveModule ?? 0,
        startTime: partial?.startTime ?? dayjs(),
        endTime: partial?.endTime ?? dayjs(),
        type: partial?.type ?? EventType.EXERCISE,
        courses: partial?.courses ?? [],
        rooms: partial?.rooms ?? [],
        instructors: partial?.instructors ?? [],
        lecturers: partial?.lecturers ?? [],
        tags: partial?.tags ?? [],
        notes: partial?.notes ?? '',
        locked: partial?.locked ?? false,
        required: partial?.required ?? false,
        hidden: partial?.hidden ?? false,
        personalTalk: partial?.personalTalk ?? false,
    };
}
