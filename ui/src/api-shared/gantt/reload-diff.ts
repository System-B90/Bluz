import { diffEventFields } from "@/api-shared/event-history";
import { DbEventDocument } from "@/api-shared/types/event";
import {
    ReloadConflictReason,
    ReloadDiff,
} from "@/api-shared/types/gantt/reload";

/**
 * Pure reconciliation between a freshly planned cut and the schedule events an
 * earlier cut produced. No DB, no dates parsing beyond ISO serialization —
 * the server feeds it plain documents and it returns the intended diff.
 */

/**
 * Fields the gantt owns. Everything else on a cut event (rooms, tags, colors,
 * locked/hidden flags, …) is schedule-side data the cut never wrote, so a
 * reload must not touch it — comparing it would report phantom drift.
 */
export const GANTT_OWNED_FIELDS: ReadonlyArray<keyof DbEventDocument> = [
    "name",
    "type",
    "subject",
    "hiveModule",
    "hiveLesson",
    "startTime",
    "endTime",
    "courses",
    "instructors",
    "notes",
    "splitAcrossBreaks",
];

/** Join key for an occurrence: one gantt event on one calendar date. */
export function occurrenceKey(
    ganttEventId: string,
    occurrenceDate: string,
): string {
    return `${ganttEventId}|${occurrenceDate}`;
}

/** Project a document down to the gantt-owned fields only. */
function ganttOwnedSlice(
    event: DbEventDocument,
): Record<string, unknown> {
    const slice: Record<string, unknown> = {};
    for (const field of GANTT_OWNED_FIELDS) {
        slice[field] = event[field];
    }
    return slice;
}

export type ReloadDiffInput = {
    /** Documents the current plan would produce, ids irrelevant. */
    desired: Array<DbEventDocument>;
    /** Live cut events currently in the schedule for this curriculum. */
    actual: Array<DbEventDocument>;
    /** Event ids the change log marks as manually edited. */
    manuallyEditedIds: ReadonlySet<string>;
    /** Explanation per manually-edited event, for the conflicts dialog. */
    lastManualEditByEvent?: ReadonlyMap<string, ReloadConflictReason>;
    /** Manually-edited events the user chose to overwrite anyway. */
    overrideEventIds?: ReadonlySet<string>;
};

/**
 * Classify every occurrence into add / update / remove / conflict / unchanged.
 * Manual edits win: a drifted event that a human touched becomes a conflict
 * instead of an update, unless its id is in `overrideEventIds`.
 * @example
 * ```typescript
 * const diff = buildReloadDiff({ desired, actual, manuallyEditedIds });
 * ```
 */
export function buildReloadDiff(input: ReloadDiffInput): ReloadDiff {
    const {
        actual,
        desired,
        lastManualEditByEvent,
        manuallyEditedIds,
        overrideEventIds,
    } = input;

    const actualByKey = new Map<string, DbEventDocument>();
    for (const event of actual) {
        if (!event.ganttEventId || !event.ganttOccurrenceDate) continue;
        actualByKey.set(
            occurrenceKey(event.ganttEventId, event.ganttOccurrenceDate),
            event,
        );
    }

    const diff: ReloadDiff = {
        additions: [],
        conflicts: [],
        removals: [],
        unchanged: 0,
        updates: [],
    };

    const isProtected = (eventId: string): boolean =>
        manuallyEditedIds.has(eventId) && !overrideEventIds?.has(eventId);

    const seenKeys = new Set<string>();
    for (const wanted of desired) {
        const key = occurrenceKey(
            wanted.ganttEventId!,
            wanted.ganttOccurrenceDate!,
        );
        seenKeys.add(key);
        const existing = actualByKey.get(key);

        if (!existing) {
            diff.additions.push({
                endTime: wanted.endTime.toISOString(),
                ganttEventId: wanted.ganttEventId!,
                occurrenceDate: wanted.ganttOccurrenceDate!,
                startTime: wanted.startTime.toISOString(),
                title: wanted.name,
            });
            continue;
        }

        const changes = diffEventFields(
            ganttOwnedSlice(existing),
            ganttOwnedSlice(wanted),
        );
        if (changes.length === 0) {
            diff.unchanged++;
            continue;
        }

        const entry = {
            changes,
            eventId: existing.id,
            ganttEventId: wanted.ganttEventId!,
            occurrenceDate: wanted.ganttOccurrenceDate!,
            title: existing.name,
        };
        if (isProtected(existing.id)) {
            diff.conflicts.push({
                ...entry,
                kind: "update",
                lastManualEdit:
                    lastManualEditByEvent?.get(existing.id) ?? null,
            });
        } else {
            diff.updates.push(entry);
        }
    }

    for (const [key, existing] of actualByKey) {
        if (seenKeys.has(key)) continue;
        const entry = {
            eventId: existing.id,
            ganttEventId: existing.ganttEventId!,
            occurrenceDate: existing.ganttOccurrenceDate!,
            title: existing.name,
        };
        if (isProtected(existing.id)) {
            diff.conflicts.push({
                ...entry,
                changes: [],
                kind: "removal",
                lastManualEdit:
                    lastManualEditByEvent?.get(existing.id) ?? null,
            });
        } else {
            diff.removals.push(entry);
        }
    }

    return diff;
}
