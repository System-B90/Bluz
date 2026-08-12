import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A snapshot restore is a human decision about every event it touches, so it
 * must land in the change log — otherwise a later gantt reload would consider
 * the restored events untouched and overwrite them.
 */

vi.mock("@/api-server/web-socket-utils", () => ({
    SendServerRequestToSessionServer: vi.fn(),
}));
vi.mock("@/api-server/db-event-history", () => ({
    DbEventHistory: { add: vi.fn(async () => {}), recordBulk: vi.fn(async () => {}) },
}));

import { DbCalendarSnapshot } from "@/api-server/db-calendar-snapshot";
import { DbEventHistory } from "@/api-server/db-event-history";
import {
    EventChangeAction,
    EventChangeInitiator,
} from "@/api-shared/types/event-history";

const snapshotEvent = (id: string) => ({
    endTime: new Date("2026-06-28T10:00:00.000Z"),
    id,
    name: "Lecture",
    startTime: new Date("2026-06-28T09:00:00.000Z"),
});

function makeController(snapshotEvents: Array<ReturnType<typeof snapshotEvent>>) {
    return {
        calendarSnapshots: {
            findOne: vi.fn(async () => ({
                createdAt: "2026-06-01T00:00:00.000Z",
                eventCount: snapshotEvents.length,
                events: snapshotEvents,
                id: "snap1",
                label: "before",
            })),
        },
        events: {
            bulkWrite: vi.fn(async () => ({ ok: 1 })),
            find: vi.fn(() => ({
                toArray: async () => [{ id: "live-only" }, { id: "e1" }],
            })),
            updateMany: vi.fn(async () => ({ modifiedCount: 1 })),
        },
    };
}

let controller: ReturnType<typeof makeController>;

beforeEach(() => {
    vi.clearAllMocks();
    controller = makeController([snapshotEvent("e1")]);
});

describe("snapshot restore — change log", () => {
    it("logs every restored event as a snapshot-restore write", async () => {
        await DbCalendarSnapshot.restore("snap1", controller as never);

        expect(DbEventHistory.recordBulk).toHaveBeenCalledWith(
            expect.objectContaining({
                action: EventChangeAction.Created,
                events: [expect.objectContaining({ eventId: "e1" })],
                origin: {
                    context: { snapshotId: "snap1" },
                    initiator: EventChangeInitiator.SnapshotRestore,
                },
            }),
        );
    });

    it("logs live events the restore removed as archivals", async () => {
        await DbCalendarSnapshot.restore("snap1", controller as never);

        const archival = vi
            .mocked(DbEventHistory.recordBulk)
            .mock.calls.map((call) => call[0])
            .find((args) => args.action === EventChangeAction.Archived);

        expect(archival?.events).toEqual([{ eventId: "live-only" }]);
        expect(archival?.origin.initiator).toBe(
            EventChangeInitiator.SnapshotRestore,
        );
    });

    it("marks a restored event as manually touched for the gantt reload", async () => {
        await DbCalendarSnapshot.restore("snap1", controller as never);

        const initiators = vi
            .mocked(DbEventHistory.recordBulk)
            .mock.calls.map((call) => call[0].origin.initiator);
        // SnapshotRestore is deliberately *not* a gantt initiator.
        expect(initiators).not.toContain(EventChangeInitiator.GanttReload);
        expect(initiators).not.toContain(EventChangeInitiator.GanttCut);
    });

    it("writes nothing to the log when the snapshot holds no events", async () => {
        controller = makeController([]);

        await expect(
            DbCalendarSnapshot.restore("snap1", controller as never),
        ).rejects.toThrow();
        expect(DbEventHistory.recordBulk).not.toHaveBeenCalled();
    });
});
