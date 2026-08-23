import { randomUUID } from "crypto";

import {
    databaseController,
    DatabaseController,
} from "@/api-server/mongo-db-controller";
import { getSessionUser } from "@/api-server/session-user";
import { diffEventFields } from "@/api-shared/event-history";
import { DbEventDocument, EventId } from "@/api-shared/types/event";
import {
    EventChangeAction,
    EventChangeContext,
    EventChangeInitiator,
    EventHistoryEntry,
} from "@/api-shared/types/event-history";
import { logger } from "@/logging/pino";

/**
 * Persistence for the event change log. Single responsibility: turn a
 * before/after pair plus an origin into one immutable row. Nothing here mutates
 * events, and no read path depends on it — a logging failure must never fail
 * the write it describes.
 */

/**
 * Who/what is performing a write. Actor identity is always resolved
 * server-side from the session; only the initiator is declared by the caller.
 */
export type EventWriteOrigin = {
    initiator: EventChangeInitiator;
    context?: EventChangeContext;
    /**
     * Pre-resolved actor, for bulk writes that would otherwise resolve the
     * session once per event (cut, reload, snapshot restore).
     */
    actor?: { id: string; displayName: string } | null;
};

/** Origin used when a call site declares nothing (CLI, scripts, legacy). */
export const UNKNOWN_ORIGIN: EventWriteOrigin = {
    initiator: EventChangeInitiator.Unknown,
};

/**
 * Resolve the acting user once, for reuse across a bulk write.
 * @returns The session user, or null outside a request scope / for machines.
 */
export async function resolveActor(): Promise<
    { displayName: string; id: string } | null
    > {
    return await getSessionUser().catch(() => null);
}

/** Numeric form of a Hive user id, for joins; null when non-numeric. */
function toHiveId(actorId: null | string | undefined): null | number {
    const parsed = Number(actorId);
    return actorId && Number.isFinite(parsed) ? parsed : null;
}

async function recordEntry(
    entry: Omit<
        EventHistoryEntry,
        "actorHiveId" | "actorId" | "actorName" | "changedAt" | "id"
    >,
    origin: EventWriteOrigin,
    controller: DatabaseController,
): Promise<void> {
    const actor =
        origin.actor !== undefined ? origin.actor : await resolveActor();

    await controller.eventHistory.insertOne({
        ...entry,
        id: randomUUID(),
        actorHiveId: toHiveId(actor?.id),
        actorId: actor?.id ?? null,
        actorName: actor?.displayName ?? null,
        changedAt: new Date(),
    });
}

/**
 * Append one row describing a write. Never throws: the log is best-effort and
 * must not take down the write it documents.
 * @param args.eventId Event the change applies to.
 * @param args.action What kind of write happened.
 * @param args.before Stored document before the write (null on creation).
 * @param args.after Document after the write (omit for archival).
 * @param args.origin Declared initiator plus optional context/actor.
 * @example
 * ```typescript
 * await DbEventHistory.record({
 *     eventId, action: EventChangeAction.Updated,
 *     before: stored, after: incoming, origin, controller,
 * });
 * ```
 */
async function record(args: {
    action: EventChangeAction;
    after?: DbEventDocument | null;
    before?: DbEventDocument | null;
    controller?: DatabaseController;
    eventId: EventId;
    origin?: EventWriteOrigin;
}): Promise<void> {
    const {
        action,
        after = null,
        before = null,
        controller = databaseController,
        eventId,
        origin = UNKNOWN_ORIGIN,
    } = args;

    try {
        const changes =
            action === EventChangeAction.Updated && after
                ? diffEventFields(
                    before as null | Record<string, unknown>,
                    after as unknown as Record<string, unknown>,
                )
                : [];

        // A no-op save (user pressed Save without editing) adds no row.
        if (action === EventChangeAction.Updated && changes.length === 0) return;

        await recordEntry(
            {
                action,
                changes,
                context: origin.context,
                eventId,
                initiator: origin.initiator,
            },
            origin,
            controller,
        );
    } catch (error) {
        logger.error({ err: error }, `Failed to record event history for ${eventId}`);
    }
}

/** Bulk variant of {@link record} for cut/reload writes. */
async function recordMany(args: {
    action: EventChangeAction;
    controller?: DatabaseController;
    events: Array<{
        after?: DbEventDocument | null;
        before?: DbEventDocument | null;
        eventId: EventId;
    }>;
    origin: EventWriteOrigin;
}): Promise<void> {
    const { action, controller = databaseController, events, origin } = args;
    if (events.length === 0) return;

    try {
        const actor =
            origin.actor !== undefined ? origin.actor : await resolveActor();
        const changedAt = new Date();

        const rows: Array<EventHistoryEntry> = [];
        for (const item of events) {
            const changes =
                action === EventChangeAction.Updated && item.after
                    ? diffEventFields(
                        item.before as null | Record<string, unknown>,
                        item.after as unknown as Record<string, unknown>,
                    )
                    : [];
            if (action === EventChangeAction.Updated && changes.length === 0) {
                continue;
            }
            rows.push({
                action,
                actorHiveId: toHiveId(actor?.id),
                actorId: actor?.id ?? null,
                actorName: actor?.displayName ?? null,
                changedAt,
                changes,
                context: origin.context,
                eventId: item.eventId,
                id: randomUUID(),
                initiator: origin.initiator,
            });
        }

        if (rows.length > 0) await controller.eventHistory.insertMany(rows);
    } catch (error) {
        logger.error({ err: error }, "Failed to record bulk event history");
    }
}

/** Full log of one event, newest first. */
async function listForEvent(
    eventId: EventId,
    controller: DatabaseController = databaseController,
): Promise<Array<EventHistoryEntry>> {
    return await controller.eventHistory
        .find({ eventId })
        .sort({ changedAt: -1 })
        .toArray();
}

/**
 * Logs of many events at once, grouped by event id. Used by the gantt reload to
 * classify a whole cut in one query instead of N.
 */
async function listForEvents(
    eventIds: Array<EventId>,
    controller: DatabaseController = databaseController,
): Promise<Map<EventId, Array<EventHistoryEntry>>> {
    const grouped = new Map<EventId, Array<EventHistoryEntry>>();
    if (eventIds.length === 0) return grouped;

    const rows = await controller.eventHistory
        .find({ eventId: { $in: eventIds } })
        .toArray();
    for (const row of rows) {
        const list = grouped.get(row.eventId) ?? [];
        list.push(row);
        grouped.set(row.eventId, list);
    }
    return grouped;
}

export namespace DbEventHistory {
    export const add = record;
    export const recordBulk = recordMany;
    export const forEvent = listForEvent;
    export const forEvents = listForEvents;
}
