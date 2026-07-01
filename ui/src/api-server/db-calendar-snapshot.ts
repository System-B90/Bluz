import { randomUUID } from "crypto";

import {
    databaseController,
    DatabaseController,
} from "@/api-server/mongo-db-controller";
import { eventDateFixup } from "@/api-shared/calendar";
import { ClientApiError } from "@/api-shared/errors";
import {
    CalendarSnapshot,
    CalendarSnapshotSummary,
} from "@/api-shared/types";
import { DbEventDocument } from "@/api-shared/types/event";
import { IterationId } from "@/api-shared/types/iteration";

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
        events: events.map(eventDateFixup),
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
): Promise<Array<CalendarSnapshotSummary>> {
    const docs = await controller.calendarSnapshots
        .find({}, { projection: { events: 0, _id: 0 } })
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
        events: (doc.events ?? []).map(eventDateFixup),
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

function toSummary(snapshot: CalendarSnapshot): CalendarSnapshotSummary {
    const { events, ...rest } = snapshot;
    return { ...rest, eventCount: events.length };
}

export namespace DbCalendarSnapshot {
    export const create = createSnapshot;
    export const list = listSnapshots;
    export const get = getSnapshot;
    export const del = deleteSnapshot;
}
