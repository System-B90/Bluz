import { safeApiFetcher } from "@/api-client/common";
import { eventDateFixup } from "@/api-shared/calendar";
import {
    CalendarSnapshot,
    CalendarSnapshotRestoreResult,
    CalendarSnapshotSummary,
} from "@/api-shared/types";
import { DbEventDocument, Event } from "@/api-shared/types/event";
import { IterationId } from "@/api-shared/types/iteration";

const SNAPSHOTS_PATH = "/api/calendar/snapshots";

function withIteration(endpoint: URL, iterationId?: IterationId): URL {
    if (iterationId) {
        endpoint.searchParams.set("it", iterationId);
    }
    return endpoint;
}

/** Lists all calendar snapshots (newest first), without their events payload. */
export async function apiListSnapshots(
    iterationId?: IterationId,
): Promise<Array<CalendarSnapshotSummary>> {
    const endpoint = withIteration(
        new URL(SNAPSHOTS_PATH, window.location.origin),
        iterationId,
    );
    return await safeApiFetcher<Array<CalendarSnapshotSummary>>(
        endpoint.toString(),
        { method: "GET" },
    );
}

/** Creates a named snapshot capturing the supplied events. */
export async function apiCreateSnapshot(
    label: string,
    events: Array<Event>,
    iterationId?: IterationId,
): Promise<CalendarSnapshotSummary> {
    const endpoint = withIteration(
        new URL(SNAPSHOTS_PATH, window.location.origin),
        iterationId,
    );
    return await safeApiFetcher<CalendarSnapshotSummary>(endpoint.toString(), {
        method: "POST",
        body: JSON.stringify({ label, events }),
    });
}

/**
 * Fetches a single snapshot including its captured events, mapped back into the
 * client `Event` shape (Dayjs timestamps) ready for a SET_EVENTS restore.
 */
export async function apiGetSnapshot(
    snapshotId: string,
    iterationId?: IterationId,
): Promise<{ snapshot: CalendarSnapshot; events: Array<Event> }> {
    const endpoint = withIteration(
        new URL(SNAPSHOTS_PATH, window.location.origin),
        iterationId,
    );
    endpoint.searchParams.set("id", snapshotId);
    const snapshot = await safeApiFetcher<CalendarSnapshot>(
        endpoint.toString(),
        { method: "GET" },
    );
    const events = (snapshot.events ?? []).map(
        (e: DbEventDocument) => eventDateFixup(e) as unknown as Event,
    );
    return { snapshot, events };
}

/**
 * Restores the calendar to a snapshot's state on the server. The server
 * archives live events within the snapshot's date range, re-inserts the
 * snapshot's events, and broadcasts the change to all connected clients.
 */
export async function apiRestoreSnapshot(
    snapshotId: string,
    iterationId?: IterationId,
): Promise<CalendarSnapshotRestoreResult> {
    const endpoint = withIteration(
        new URL(`${SNAPSHOTS_PATH}/restore`, window.location.origin),
        iterationId,
    );
    endpoint.searchParams.set("id", snapshotId);
    return await safeApiFetcher<CalendarSnapshotRestoreResult>(
        endpoint.toString(),
        { method: "POST" },
    );
}

/** Permanently deletes a snapshot. */
export async function apiDeleteSnapshot(
    snapshotId: string,
    iterationId?: IterationId,
): Promise<void> {
    const endpoint = withIteration(
        new URL(SNAPSHOTS_PATH, window.location.origin),
        iterationId,
    );
    endpoint.searchParams.set("id", snapshotId);
    await safeApiFetcher<void>(endpoint.toString(), { method: "DELETE" });
}
