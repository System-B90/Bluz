import {
    EventChangeInitiator,
    EventFieldChange,
    EventHistoryEntry,
    isGanttInitiator,
} from "@/api-shared/types/event-history";

/**
 * Pure helpers for the event change log: what counts as a change, and what the
 * log says about who last touched an event. No DB, no I/O — shared by the
 * server (which writes rows) and the client (which renders them).
 */

/**
 * Fields excluded from diffing: bookkeeping that changes on every write and
 * carries no editorial meaning.
 */
const IGNORED_FIELDS: ReadonlySet<string> = new Set([
    "id",
    "updatedAt",
    "_id",
]);

/**
 * Duck-typed rather than `instanceof dayjs`: this module is shared by both
 * sides and must not pull a client date library into the server bundle.
 */
function isDayjsLike(value: unknown): value is { valueOf: () => number } {
    return (
        typeof value === "object" &&
        value !== null &&
        ("$isDayjsObject" in value || "$d" in value) &&
        typeof (value as { valueOf?: unknown }).valueOf === "function"
    );
}

/** Normalize a value to a stable, comparable JSON primitive. */
function normalize(value: unknown): unknown {
    if (value instanceof Date) return value.getTime();
    // The client hands times over as Dayjs, the server as Date. Comparing the
    // two shapes as-is reports a change on every save and floods the log.
    if (isDayjsLike(value)) return value.valueOf();
    if (value === undefined) return null;
    if (Array.isArray(value)) return value.map(normalize);
    return value;
}

function isEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

/**
 * Field-level diff between two versions of an event document.
 * @param before The stored document, or null for a creation.
 * @param after The document being written.
 * @returns One entry per differing field; empty when nothing changed.
 * @example
 * ```typescript
 * const changes = diffEventFields(stored, incoming); // [{ field: "startTime", … }]
 * ```
 */
export function diffEventFields(
    before: null | Record<string, unknown>,
    after: Record<string, unknown>,
): Array<EventFieldChange> {
    if (!before) return [];

    const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
    const changes: Array<EventFieldChange> = [];
    for (const field of fields) {
        if (IGNORED_FIELDS.has(field)) continue;
        if (isEqual(before[field], after[field])) continue;
        changes.push({
            field,
            from: normalize(before[field]),
            to: normalize(after[field]),
        });
    }
    return changes.sort((a, b) => a.field.localeCompare(b.field));
}

/**
 * Whether an event's log contains a human edit, i.e. any change whose
 * initiator is not part of the gantt pipeline.
 * @param entries The event's history rows (any order).
 */
export function hasManualEdit(
    entries: Array<Pick<EventHistoryEntry, "initiator">>,
): boolean {
    return entries.some((entry) => !isGanttInitiator(entry.initiator));
}

/**
 * The most recent manual change of an event, used to explain a skipped reload
 * in the conflicts dialog.
 * @param entries The event's history rows (any order).
 * @returns The newest non-gantt row, or null when the event was never edited.
 */
export function lastManualEdit<
    T extends Pick<EventHistoryEntry, "changedAt" | "initiator">,
>(entries: Array<T>): null | T {
    let latest: null | T = null;
    for (const entry of entries) {
        if (isGanttInitiator(entry.initiator)) continue;
        if (
            !latest ||
            new Date(entry.changedAt).getTime() >
                new Date(latest.changedAt).getTime()
        ) {
            latest = entry;
        }
    }
    return latest;
}

/**
 * Hebrew labels for the event fields a change row can name. Shared by the
 * history panel and the reload-conflicts dialog so a field is never called
 * two different things in two places.
 */
export const EVENT_FIELD_LABELS: Record<string, string> = {
    archived: "מחיקה",
    color: "צבע",
    courses: "מסלולים",
    endTime: "שעת סיום",
    fake: "מופע פיקטיבי",
    hidden: "מוסתר",
    hiveLesson: "שיעור",
    hiveModule: "מודול",
    instructors: "מדריכים",
    lecturers: "מרצים",
    locked: "נעול",
    name: "שם",
    notes: "הערות",
    personalTalk: 'שיחה אישית',
    prayerType: "סוג תפילה",
    required: "חובה",
    rooms: "חדרים",
    splitAcrossBreaks: "פיצול סביב הפסקות",
    startTime: "שעת התחלה",
    subject: "מקצוע",
    tags: "תגיות",
    type: "סוג",
};

/**
 * Display label for a changed field, falling back to the raw key so a field
 * added later still renders something meaningful.
 * @param field The field key from a change row.
 */
export function eventFieldLabel(field: string): string {
    return EVENT_FIELD_LABELS[field] ?? field;
}

/** Hebrew label for an initiator, for history and conflict UIs. */
export const INITIATOR_LABELS: Record<EventChangeInitiator, string> = {
    [EventChangeInitiator.GanttCut]: 'גזירה ללו"ז',
    [EventChangeInitiator.GanttReload]: 'עדכון לו"ז מהגאנט',
    [EventChangeInitiator.GanttPullBack]: "משיכה חזרה",
    [EventChangeInitiator.EventDialog]: "עריכה בחלון המופע",
    [EventChangeInitiator.DragDrop]: "גרירה בלוח",
    [EventChangeInitiator.Resize]: "שינוי משך בלוח",
    [EventChangeInitiator.CopyPaste]: "העתקה/הדבקה",
    [EventChangeInitiator.InstructorAssign]: "שיוך מדריך",
    [EventChangeInitiator.Keyboard]: "קיצור מקלדת בלוח",
    [EventChangeInitiator.PrayerSettings]: "עדכון זמני תפילה",
    [EventChangeInitiator.OfflinePush]: "סנכרון ממצב לא־מקוון",
    [EventChangeInitiator.SnapshotRestore]: "שחזור תמונת מצב",
    [EventChangeInitiator.GoogleSync]: "סנכרון מיומן Google",
    [EventChangeInitiator.Undo]: "ביטול/ביצוע חוזר",
    [EventChangeInitiator.Unknown]: "לא ידוע",
};
