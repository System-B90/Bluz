import { Event } from "@/components/schedule/types/event";

export interface EventDataUpdateMessage
{
    events: Record<string, Event>;
}
interface EventRemovedMessage
{
    action: 'removed';
    eventId: string;
}

interface EventAddedMessage
{
    action: 'added';
    eventId: string;
    newData: Event;
}

export type EventAddedOrRemovedMessage = EventRemovedMessage | EventAddedMessage;