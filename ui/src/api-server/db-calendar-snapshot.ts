import { randomUUID } from "crypto";

import { DbEventHistory } from "@/api-server/db-event-history";
import {
    databaseController,
    DatabaseController,
} from "@/api-server/mongo-db-controller";
import { withOptionalTransaction } from "@/api-server/mongo-transactions";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { eventDateFixupToDate } from "@/api-shared/calendar";
import { ClientApiError } from "@/api-shared/errors";
import {
    CalendarSnapshot,
    CalendarSnapshotRestoreResult,
    CalendarSnapshotSummary,
    EventAddedOrRemovedMessage,
    EventDataUpdateMessage,
} from "@/api-shared/types";
import { DbEventDocument } from "@/api-shared/types/event";
import {
    EventChangeAction,
    EventChangeInitiator,
} from "@/api-shared/types/event-history";
import { IterationId } from "@/api-shared/types/iteration";
import { MessageTypes } from "@/settings";

/** Hard ceiling on captured events to keep a single snapshot document sane. */
const MAX_SNAPSHOT_EVENTS = 10_000;

/**
 * Captures a named, git-tag-like restore point of the calendar. The full event
 * documents are stored so the calendar can later be restored to this exact state.
 *
 * @returns The lightweight summary of the created snapshot (no events payload).
 */
async function createSnapshot(
    label: string,
    events: Array<DbEventDocument>,
    controller: DatabaseController = databaseController,
    iterationId?: IterationId,
): Promise<CalendarSnapshotSummary> {
    const trimmedLabel = label?.trim();
    if (!trimmedLabel) {
        throw new ClientApiError("Snapshot label is required.");
    }
    events = events ?? [];
    if (events.length > MAX_SNAPSHOT_EVENTS) {
        throw new ClientApiError(
            `Snapshot exceeds the ${MAX_SNAPSHOT_EVENTS}-event limit.`,
        );
    }

    const snapshot: CalendarSnapshot = {
        id: randomUUID(),
        label: trimmedLabel,
        createdAt: new Date().toISOString(),
        iterationId,
        events: events.map(eventDateFixupToDate),
    };

    // Denormalize the count so the list endpoint can project `events` out and
    // still report how many events each snapshot holds.
    await controller.calendarSnapshots.insertOne({
        ...snapshot,
        eventCount: snapshot.events.length,
    } as never);

    return toSummary(snapshot);
}

/** Lists snapshots newest-first, without their (large) events payload. */
async function listSnapshots(
    controller: DatabaseController = databaseController,
    iterationId?: IterationId,
): Promise<Array<CalendarSnapshotSummary>> {
    const docs = await controller.calendarSnapshots
        .find(
            iterationId ? { iterationId } : {},
            { projection: { events: 0, _id: 0 } },
        )
        .sort({ createdAt: -1 })
        .toArray();

    // `events` is projected out; the denormalized `eventCount` carries the size.
    return docs.map((doc) => ({
        id: doc.id,
        label: doc.label,
        createdAt: doc.createdAt,
        iterationId: doc.iterationId,
        eventCount: (doc as { eventCount?: number }).eventCount ?? 0,
    }));
}

/** Fetches a single snapshot, including its full captured events. */
async function getSnapshot(
    snapshotId: string,
    controller: DatabaseController = databaseController,
): Promise<CalendarSnapshot> {
    if (!snapshotId) {
        throw new ClientApiError("Snapshot id is missing.");
    }
    const doc = await controller.calendarSnapshots.findOne(
        { id: snapshotId },
        { projection: { _id: 0 } },
    );
    if (!doc) {
        throw new ClientApiError(`Snapshot ${snapshotId} not found.`);
    }
    return {
        id: doc.id,
        label: doc.label,
        createdAt: doc.createdAt,
        iterationId: doc.iterationId,
        events: (doc.events ?? []).map(eventDateFixupToDate),
    };
}

/** Permanently removes a snapshot. */
async function deleteSnapshot(
    snapshotId: string,
    controller: DatabaseController = databaseController,
): Promise<void> {
    if (!snapshotId) {
        throw new ClientApiError("Snapshot id is missing.");
    }
    const result = await controller.calendarSnapshots.deleteOne({
        id: snapshotId,
    });
    if (result.deletedCount === 0) {
        throw new ClientApiError(`Snapshot ${snapshotId} not found.`);
    }
}

/**
 * Restores the calendar to a snapshot's state within the snapshot's own date
 * range: live events inside the range are archived (soft-deleted), the
 * snapshot's events are upserted back, and connected clients are notified via
 * WebSocket broadcasts.
 */
async function restoreSnapshot(
    snapshotId: string,
    controller: DatabaseController = databaseController,
    iterationId?: IterationId,
): Promise<CalendarSnapshotRestoreResult> {
    const snapshot = await getSnapshot(snapshotId, controller);
    const events = snapshot.events ?? [];
    if (events.length === 0) {
        throw new ClientApiError(
            "Snapshot has no events — nothing to restore.",
        );
    }

    const rangeStart = new Date(
        Math.min(...events.map((e) => e.startTime.getTime())),
    );
    const rangeEnd = new Date(
        Math.max(...events.map((e) => e.endTime.getTime())),
    );

    // Live events fully inside the snapshot's range get replaced by the restore.
    const existingIds = (
        await controller.events
            .find(
                {
                    startTime: { $gte: rangeStart },
                    endTime: { $lte: rangeEnd },
                    archived: { $ne: true },
                },
                { projection: { id: 1, _id: 0 } },
            )
            .toArray()
    ).map((doc) => doc.id);

    // Archiving the live range and writing the snapshot back are two halves of
    // one decision: a crash between them left the calendar emptied with nothing
    // restored (#517). They run under one transaction where the deployment
    // supports it; on a standalone mongod withOptionalTransaction logs the
    // degradation loudly rather than failing the restore.
    await withOptionalTransaction(
        controller.client,
        async (session) => {
            if (existingIds.length > 0) {
                await controller.events.updateMany(
                    { id: { $in: existingIds } },
                    { $set: { archived: true } },
                    { session },
                );
            }

            // Upserting by id also un-archives originals that survived into the
            // snapshot.
            await controller.events.bulkWrite(
                events.map((event) => ({
                    replaceOne: {
                        filter: { id: event.id },
                        replacement: { ...event, archived: false },
                        upsert: true,
                    },
                })),
                { session },
            );
        },
        "restoreSnapshot",
    );

    const restoredIds = new Set(events.map((e) => e.id));
    const removedIds = existingIds.filter((id) => !restoredIds.has(id));

    // A restore is a human decision about every event it touches, so it must
    // land in the change log — that log is what protects edited events from
    // being overwritten by a later gantt reload.
    const restoreOrigin = {
        context: { snapshotId },
        initiator: EventChangeInitiator.SnapshotRestore,
    };
    await DbEventHistory.recordBulk({
        action: EventChangeAction.Created,
        controller,
        events: events.map((event) => ({ after: event, eventId: event.id })),
        origin: restoreOrigin,
    });
    await DbEventHistory.recordBulk({
        action: EventChangeAction.Archived,
        controller,
        events: removedIds.map((eventId) => ({ eventId })),
        origin: restoreOrigin,
    });

    SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE, {
        events: Object.fromEntries(events.map((e) => [e.id, e])),
        iterationId,
    } as EventDataUpdateMessage<DbEventDocument>);
    for (const eventId of removedIds) {
        SendServerRequestToSessionServer(MessageTypes.EVENT_ADDED_OR_REMOVED, {
            action: "removed",
            eventId,
            iterationId,
        } as EventAddedOrRemovedMessage<DbEventDocument>);
    }

    return {
        restoredCount: events.length,
        removedCount: removedIds.length,
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
    };
}

function toSummary(snapshot: CalendarSnapshot): CalendarSnapshotSummary {
    const { events, ...rest } = snapshot;
    return { ...rest, eventCount: events?.length ?? 0 };
}

export namespace DbCalendarSnapshot {
    export const create = createSnapshot;
    export const list = listSnapshots;
    export const get = getSnapshot;
    export const del = deleteSnapshot;
    export const restore = restoreSnapshot;
}
