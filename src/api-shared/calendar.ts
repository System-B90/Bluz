import { Event, EventId } from "@/components/schedule/types/event";
import dayjs from "dayjs";

export function eventDateFixup(event: Partial<Event> & { id: EventId; }): Partial<Event> & { id: EventId; };
export function eventDateFixup(event: Partial<Event>): Partial<Event>;
export function eventDateFixup(event: Event): Event;
export function eventDateFixup(event: Partial<Event>): Partial<Event>
{
    if (typeof window === 'undefined')
    {
        event.endTime = new Date(event.endTime as unknown as string);
        event.startTime = new Date(event.startTime as unknown as string);
    }
    else
    {
        event.endTime = dayjs(event.endTime);
        event.startTime = dayjs(event.startTime);
    }
    return event;
}
