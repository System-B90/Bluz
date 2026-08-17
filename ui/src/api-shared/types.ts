import { DbEventDocument, Event } from "@/api-shared/types/event";

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
    iterationId?: string;
};

export type EventUnlockMessage = {
    eventId: string;
    iterationId?: string;
};

// Snapshot: a named, git-tag-like point-in-time copy of the calendar. It stores
// the full event documents so the calendar can be restored to this exact state
// later via a SET_EVENTS dispatch.
export type CalendarSnapshot = {
    id: string;
    label: string;
    createdAt: string;
    // The iteration this snapshot was taken from (undefined ⇒ current run).
    iterationId?: string;
    // Full captured event documents at snapshot time.
    events: Array<DbEventDocument>;
};

// Lightweight list-row variant returned by the list endpoint — omits the (large)
// events payload and exposes just the count.
export type CalendarSnapshotSummary = Omit<CalendarSnapshot, "events"> & {
    eventCount: number;
};

// Result of a server-side snapshot restore: how many events were written back,
// how many live events inside the snapshot's range were removed, and the exact
// date range (ISO strings) the restore operated on.
export type CalendarSnapshotRestoreResult = {
    restoredCount: number;
    removedCount: number;
    rangeStart: string;
    rangeEnd: string;
};

// Draft: a named, server-persisted working copy of the calendar, shared across
// users. Unlike a snapshot (an immutable restore point), a draft is mutable —
// any user can load it, edit, and re-save it. `updatedBy` records the last
// editor so collaborators can see who touched it most recently.
export type CalendarDraft = {
    id: string;
    label: string;
    createdAt: string;
    updatedAt: string;
    updatedBy: string;
    updatedById?: string;
    // The iteration this draft belongs to (undefined ⇒ current run).
    iterationId?: string;
    events: Array<DbEventDocument>;
};

// List-row variant — omits the events payload, exposes the count.
export type CalendarDraftSummary = Omit<CalendarDraft, "events"> & {
    eventCount: number;
};
