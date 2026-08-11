import { EventId } from "@/api-shared/types/event";

/**
 * Change log for schedule events (#…, "היסטוריית שינויים"). Every write to an
 * event appends one immutable row to its own `eventHistory` collection —
 * events themselves stay free of audit columns, so the log is normalized:
 * a row references the event by id and never copies its state.
 *
 * The log is also the ground truth for "was this event touched by a human?",
 * which the gantt schedule-reload (`api-server/gantt/reload.ts`) uses to decide
 * whether a re-cut may overwrite an event.
 */

/**
 * What produced a change. Gantt-produced values are grouped by
 * {@link isGanttInitiator} — everything else counts as a manual edit.
 */
export enum EventChangeInitiator {
    /** Curriculum → schedule cut (גזירה ללו"ז). */
    GanttCut = "gantt-cut",
    /** Schedule reload from an updated gantt (עדכון לו"ז). */
    GanttReload = "gantt-reload",
    /** Pull-back of a previous cut (משיכה חזרה). */
    GanttPullBack = "gantt-pull-back",
    /** Event dialog save. */
    EventDialog = "event-dialog",
    /** Drag-and-drop move on the calendar grid. */
    DragDrop = "drag-drop",
    /** Resize handle on the calendar grid. */
    Resize = "resize",
    /** Copy/paste (and duplicate) of an existing event. */
    CopyPaste = "copy-paste",
    /** Instructor assignment via the instructor drag-and-drop layer. */
    InstructorAssign = "instructor-assign",
    /** Keyboard shortcut on the calendar grid (Delete). */
    Keyboard = "keyboard",
    /** Automatic re-timing driven by the prayer-time settings. */
    PrayerSettings = "prayer-settings",
    /** Offline-mode push of locally queued edits. */
    OfflinePush = "offline-push",
    /** Restore of a calendar snapshot. */
    SnapshotRestore = "snapshot-restore",
    /** Pulled in from a linked Google Calendar. */
    GoogleSync = "google-sync",
    /** Write with no declared initiator (CLI, scripts, legacy call sites). */
    Unknown = "unknown",
}

/**
 * Header carrying the declared initiator of an event write. The client names
 * the action; the server always resolves the actor from the session itself.
 */
export const EVENT_INITIATOR_HEADER = "x-bluz-event-initiator";

const INITIATOR_VALUES: ReadonlySet<string> = new Set(
    Object.values(EventChangeInitiator),
);

/**
 * Narrow an untrusted header value to a known initiator.
 * @param value Raw header value, possibly null.
 * @returns The matching initiator, or {@link EventChangeInitiator.Unknown}.
 */
export function parseEventInitiator(
    value: null | string | undefined,
): EventChangeInitiator {
    return value && INITIATOR_VALUES.has(value)
        ? (value as EventChangeInitiator)
        : EventChangeInitiator.Unknown;
}

/** Gantt-produced initiators: machine writes, never a human decision. */
const GANTT_INITIATORS: ReadonlySet<EventChangeInitiator> = new Set([
    EventChangeInitiator.GanttCut,
    EventChangeInitiator.GanttReload,
    EventChangeInitiator.GanttPullBack,
]);

/**
 * True when a change came from the gantt pipeline rather than from a person.
 * @param initiator The recorded initiator of a change.
 */
export function isGanttInitiator(initiator: EventChangeInitiator): boolean {
    return GANTT_INITIATORS.has(initiator);
}

/** Kind of write a history row describes. */
export enum EventChangeAction {
    Created = "created",
    Updated = "updated",
    /** Soft-delete (archived: true). */
    Archived = "archived",
}

/** One changed field, with both sides serialized as plain JSON. */
export type EventFieldChange = {
    field: string;
    from: unknown;
    to: unknown;
};

/**
 * Extra provenance for a change, kept as a narrow, additive record rather than
 * a free-form blob so it stays queryable.
 */
export type EventChangeContext = {
    /** Curriculum whose cut/reload produced this change. */
    curriculumId?: string;
    /** Snapshot restored, for SnapshotRestore. */
    snapshotId?: string;
};

/**
 * One immutable change row. `actorName` is denormalized on purpose: display
 * names live in Hive (an external service), so the log stores the name as it
 * read at write time and remains readable when Hive is unreachable or the
 * user is gone.
 */
export type EventHistoryEntry = {
    /** Row id (uuid). */
    id: string;
    /** The event this row describes. Never embeds the event itself. */
    eventId: EventId;
    action: EventChangeAction;
    initiator: EventChangeInitiator;
    context?: EventChangeContext;
    /**
     * Hive user id exactly as the SSO session issued it (string), or null for
     * machine/unauthenticated writes. This is the row's foreign key to Hive.
     */
    actorId: null | string;
    /**
     * Same identity in numeric form, for joins and aggregations against Hive
     * user ids. Null when absent or non-numeric.
     */
    actorHiveId: null | number;
    /** Display name as read at write time; null for machine writes. */
    actorName: null | string;
    changedAt: Date;
    /** Empty for {@link EventChangeAction.Created}. */
    changes: Array<EventFieldChange>;
};

/** Wire form of {@link EventHistoryEntry} (dates as ISO strings). */
export type ApiEventHistoryEntry = {
    changedAt: string;
} & Omit<EventHistoryEntry, "changedAt">;

export type ApiEventHistoryResponse = Array<ApiEventHistoryEntry>;
