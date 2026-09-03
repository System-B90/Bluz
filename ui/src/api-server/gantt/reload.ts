import { DbEventHistory, resolveActor } from "@/api-server/db-event-history";
import { DbIterations } from "@/api-server/db-iterations";
import { materializeCurriculumEvents } from "@/api-server/gantt/cut";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import { syncEventToInstructorsGoogleCalendars } from "@/api-server/google/google-calendar-sync";
import {
    DatabaseController,
    getDatabaseController,
} from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { hasManualEdit, lastManualEdit } from "@/api-shared/event-history";
import {
    buildReloadDiff,
    GANTT_OWNED_FIELDS,
} from "@/api-shared/gantt/reload-diff";
import { EventAddedOrRemovedMessage, EventDataUpdateMessage } from "@/api-shared/types";
import { DbEventDocument } from "@/api-shared/types/event";
import {
    EventChangeAction,
    EventChangeInitiator,
} from "@/api-shared/types/event-history";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import {
    ApiCurriculumReloadError,
    ApiCurriculumReloadResponse,
    ReloadConflictReason,
} from "@/api-shared/types/gantt/reload";
import { Iteration } from "@/api-shared/types/iteration";
import { iterationSyncId, MessageTypes } from "@/settings";

/**
 * Schedule reload ("עדכון הלו״ז לפי הגאנט"): re-plans a curriculum that was
 * already cut and reconciles the difference into the linked iteration's
 * schedule — adding new occurrences, retiming changed ones and archiving ones
 * the gantt dropped.
 *
 * Precedence: an event a human edited after the cut wins. Such events are
 * reported as conflicts and skipped unless the caller passes their ids in
 * `overrideEventIds`. "Edited by a human" comes from the event change log
 * (`db-event-history`), never from guessing at field values.
 */

export type ReloadOutcome =
    | { ok: false; error: ApiCurriculumReloadError }
    | { ok: true; result: ApiCurriculumReloadResponse };

export type ReloadOptions = {
    dryRun?: boolean;
    force?: boolean;
    overrideEventIds?: Array<string>;
};

/**
 * Every live (non-archived) cut event in the iteration.
 *
 * Deliberately *not* filtered by the curriculum's current gantt event ids: an
 * event deleted from the gantt since the cut would then be invisible here and
 * its schedule event would survive forever as an orphan. An iteration holds
 * the cut of exactly one curriculum — the same assumption `countCutEvents` and
 * the pull-back already make — so "cut event in this iteration" is the right
 * scope.
 */
async function loadLiveCutEvents(
    controller: DatabaseController,
): Promise<Array<DbEventDocument>> {
    return await controller.events
        .find({ archived: { $ne: true }, ganttEventId: { $exists: true } })
        .toArray();
}

/**
 * Classify the cut events by whether the change log holds a non-gantt change.
 * @returns The manually edited ids plus the last manual change per event.
 */
async function classifyManualEdits(
    controller: DatabaseController,
    events: Array<DbEventDocument>,
): Promise<{
    lastManualEditByEvent: Map<string, ReloadConflictReason>;
    manuallyEditedIds: Set<string>;
}> {
    const historyByEvent = await DbEventHistory.forEvents(
        events.map((event) => event.id),
        controller,
    );

    const manuallyEditedIds = new Set<string>();
    const lastManualEditByEvent = new Map<string, ReloadConflictReason>();
    for (const [eventId, entries] of historyByEvent) {
        if (!hasManualEdit(entries)) continue;
        manuallyEditedIds.add(eventId);
        const latest = lastManualEdit(entries);
        if (latest) {
            lastManualEditByEvent.set(eventId, {
                actorName: latest.actorName,
                changedAt: new Date(latest.changedAt).toISOString(),
                initiator: latest.initiator,
            });
        }
    }
    return { lastManualEditByEvent, manuallyEditedIds };
}

/** Broadcast helper: one upsert message covering every written document. */
function broadcastUpserts(
    documents: Array<DbEventDocument>,
    iteration: Iteration,
): void {
    if (documents.length === 0) return;
    const iterationId = iteration.isCurrent ? undefined : iteration.id;
    SendServerRequestToSessionServer(
        MessageTypes.EVENT_DATA_UPDATE,
        {
            events: Object.fromEntries(documents.map((d) => [d.id, d])),
            iterationId,
        } as EventDataUpdateMessage<DbEventDocument>,
        iterationSyncId(iterationId),
    );
}

/** Broadcast helper: one removal message per archived event. */
function broadcastRemovals(
    eventIds: Array<string>,
    iteration: Iteration,
): void {
    const iterationId = iteration.isCurrent ? undefined : iteration.id;
    for (const eventId of eventIds) {
        SendServerRequestToSessionServer(
            MessageTypes.EVENT_ADDED_OR_REMOVED,
            {
                action: "removed",
                eventId,
                iterationId,
            } as EventAddedOrRemovedMessage<DbEventDocument>,
            iterationSyncId(iterationId),
        );
    }
}

/**
 * Re-cut a curriculum onto its existing schedule.
 * @param curriculumId Curriculum to reload from.
 * @param options.dryRun Compute the diff and write nothing.
 * @param options.overrideEventIds Manually-edited events to overwrite anyway.
 * @param options.force Plan around unmapped / unsatisfied-recurrence events.
 * @example
 * ```typescript
 * const preview = await reloadCurriculumSchedule(id, { dryRun: true });
 * ```
 */
export async function reloadCurriculumSchedule(
    curriculumId: GanttCurriculumId,
    options: ReloadOptions = {},
): Promise<ReloadOutcome> {
    const { dryRun = false, force = false, overrideEventIds = [] } = options;

    // Throws ClientApiError (→ 400) when the curriculum does not exist.
    const curriculum = await DbCurriculum.getItem(curriculumId);
    if (curriculum.isDraft) {
        return {
            ok: false,
            error: {
                code: "draft",
                message: 'לא ניתן לעדכן לו"ז מגאנט טיוטה',
            },
        };
    }

    const iteration = await DbIterations.getByCurriculum(curriculumId);
    if (!iteration) {
        return {
            ok: false,
            error: {
                code: "no-iteration",
                message: "לא נמצא מחזור המקושר לגאנט זה",
            },
        };
    }

    const controller = getDatabaseController(iteration.dbName);
    const actual = await loadLiveCutEvents(controller);
    if (actual.length === 0) {
        return {
            ok: false,
            error: {
                code: "not-cut",
                message: 'הגאנט טרם נגזר ללו"ז — יש לגזור אותו תחילה',
            },
        };
    }

    const materialized = await materializeCurriculumEvents(
        curriculum,
        iteration,
        controller,
        { createMissingCourses: !dryRun, force },
    );
    if (!materialized.ok) {
        return {
            ok: false,
            error: {
                code: "invalid-plan",
                errors: materialized.errors,
                message: "תוכנית הגזירה אינה תקינה",
            },
        };
    }

    const { lastManualEditByEvent, manuallyEditedIds } =
        await classifyManualEdits(controller, actual);

    const desiredByKey = new Map(
        materialized.documents.map((document) => [
            `${document.ganttEventId}|${document.ganttOccurrenceDate}`,
            document,
        ]),
    );
    const diff = buildReloadDiff({
        actual,
        desired: materialized.documents,
        lastManualEditByEvent,
        manuallyEditedIds,
        overrideEventIds: new Set(overrideEventIds),
    });

    if (dryRun) {
        return {
            ok: true,
            result: {
                addedEvents: 0,
                applied: false,
                createdCourses: [],
                diff,
                removedEvents: 0,
                skippedConflicts: diff.conflicts.length,
                updatedEvents: 0,
            },
        };
    }

    const actor = await resolveActor();
    const origin = {
        actor,
        context: { curriculumId },
        initiator: EventChangeInitiator.GanttReload,
    };

    // --- Additions -------------------------------------------------------
    const added = diff.additions
        .map((addition) =>
            desiredByKey.get(
                `${addition.ganttEventId}|${addition.occurrenceDate}`,
            ),
        )
        .filter((document): document is DbEventDocument => Boolean(document));

    if (added.length > 0) {
        await controller.events.insertMany(added);
        await DbEventHistory.recordBulk({
            action: EventChangeAction.Created,
            controller,
            events: added.map((document) => ({
                after: document,
                eventId: document.id,
            })),
            origin,
        });
        for (const document of added) {
            syncEventToInstructorsGoogleCalendars(
                document,
                "upsert",
                iteration.id,
            );
        }
    }

    // --- Updates ---------------------------------------------------------
    // Only gantt-owned fields are rewritten; schedule-side data the cut never
    // wrote (rooms, tags, colors, flags) is preserved as-is.
    const actualById = new Map(actual.map((event) => [event.id, event]));
    const updated: Array<DbEventDocument> = [];
    const historyUpdates: Array<{
        after: DbEventDocument;
        before: DbEventDocument;
        eventId: string;
    }> = [];

    // `diff.conflicts` holds only events the caller did *not* override —
    // overridden ones were already classified as ordinary updates/removals.
    // Collected, then written in one round trip: an awaited updateOne per
    // event made a reload of a full curriculum N sequential round trips (#538
    // item 9).
    const eventWrites: Array<{
        updateOne: {
            filter: { id: string };
            update: { $set: Partial<DbEventDocument> };
        };
    }> = [];

    for (const update of diff.updates) {
        const before = actualById.get(update.eventId);
        const desired = desiredByKey.get(
            `${update.ganttEventId}|${update.occurrenceDate}`,
        );
        if (!before || !desired) continue;

        const patch: Partial<DbEventDocument> = { updatedAt: Date.now() };
        for (const field of GANTT_OWNED_FIELDS) {
            (patch as Record<string, unknown>)[field] = desired[field];
        }
        const after = { ...before, ...patch } as DbEventDocument;

        eventWrites.push({
            updateOne: { filter: { id: update.eventId }, update: { $set: patch } },
        });
        updated.push(after);
        historyUpdates.push({ after, before, eventId: update.eventId });
        syncEventToInstructorsGoogleCalendars(after, "upsert", iteration.id);
    }

    if (eventWrites.length > 0) {
        await controller.events.bulkWrite(eventWrites);
    }

    if (historyUpdates.length > 0) {
        await DbEventHistory.recordBulk({
            action: EventChangeAction.Updated,
            controller,
            events: historyUpdates,
            origin,
        });
    }

    // --- Removals --------------------------------------------------------
    const removalIds = diff.removals.map((removal) => removal.eventId);
    if (removalIds.length > 0) {
        await controller.events.updateMany(
            { id: { $in: removalIds } },
            { $set: { archived: true } },
        );
        await DbEventHistory.recordBulk({
            action: EventChangeAction.Archived,
            controller,
            events: removalIds.map((eventId) => ({ eventId })),
            origin,
        });
        for (const eventId of removalIds) {
            const removed = actualById.get(eventId);
            if (removed) {
                syncEventToInstructorsGoogleCalendars(
                    removed,
                    "delete",
                    iteration.id,
                );
            }
        }
    }

    broadcastUpserts([...added, ...updated], iteration);
    broadcastRemovals(removalIds, iteration);

    return {
        ok: true,
        result: {
            addedEvents: added.length,
            applied: true,
            createdCourses: materialized.createdCourses,
            diff,
            removedEvents: removalIds.length,
            skippedConflicts: diff.conflicts.length,
            updatedEvents: updated.length,
        },
    };
}
