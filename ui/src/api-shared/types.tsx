import { DbEventDocument } from "@/api-server/db-event";
import { Event } from "@/components/schedule/types/event";

export interface EventDataUpdateMessage<T extends Event | DbEventDocument>
{
    events: Record<string, T>;
}

interface EventRemovedMessage
{
    action: 'removed';
    eventId: string;
}

interface EventAddedMessage<T extends Event | DbEventDocument>
{
    action: 'added';
    eventId: string;
    newData: T;
}

export type EventAddedOrRemovedMessage<T extends Event | DbEventDocument> = EventRemovedMessage | EventAddedMessage<T>;

export enum PotentialPA
{
    YesRecommended,
    YesNotRecommended,
    No,
    NoRecommendedButBusy,
};
