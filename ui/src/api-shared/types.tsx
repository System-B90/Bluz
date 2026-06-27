import { DbEventDocument } from "@/api-server/db-event";
import { Event } from "@/components/schedule/types/event";

export type EventDataUpdateMessage<T extends DbEventDocument | Event> = {
    events: Record<string, T>;
    // Iteration the change belongs to. Omitted ⇒ current iteration. Clients
    // ignore broadcasts for an iteration they are not currently viewing.
    iterationId?: string;
};

type EventRemovedMessage = {
    action: "removed";
    eventId: string;
    iterationId?: string;
};
type EventAddedMessage<T extends DbEventDocument | Event> = {
    action: "added";
    eventId: string;
    newData: T;
    iterationId?: string;
};

export type EventAddedOrRemovedMessage<T extends DbEventDocument | Event> =
    | EventAddedMessage<T>
    | EventRemovedMessage;

export enum PotentialPA {
    YesRecommended,
    YesNotRecommended,
    No,
    NoRecommendedButBusy,
}

// Period locking: emitted by a client when it opens/closes an event for editing.
// Broadcast to all other clients via the session server so they can display a "dirty" indicator.
export type EventLockMessage = {
    eventId: string;
    // Display name of the user who has the event open
    lockedByName: string;
    // Session ID / user ID so the owner can be compared on the receiving end
    lockedById: string;
};

export type EventUnlockMessage = {
    eventId: string;
};

// Snapshot: a named point-in-time copy of the visible calendar window.
// Intended for the future snapshot/revert feature discussed in issue #12 comments.
export type CalendarSnapshot = {
    id: string;
    label: string;
    createdAt: string;
    eventIds: Array<string>;
};
