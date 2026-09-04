import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Broadcast coverage for `DbEvent.set/create/del` (`ui/src/api-server/db-event.ts`).
 *
 * This file had no test at all before this addition, despite being the
 * single source of every event broadcast on the wire. The relay itself is
 * well covered (`ws-two-session-updates.test.ts`, hermetic, real session-server
 * core) and so is the client's handling of the resulting frames
 * (`UseEventWebsocket.ts` consumers), but nothing pinned that *this* module
 * calls `SendServerRequestToSessionServer` with the right message type,
 * iteration-scoped `targets`, and — the actual gap — the right payload for a
 * pure move/resize, which is not a distinct message type but an
 * `EVENT_DATA_UPDATE` like any other edit. A bug that broadcast a move with a
 * stale time, or scoped it to the wrong iteration, would ship silently: the
 * relay would faithfully deliver whatever this module handed it.
 */

vi.mock("@/api-server/web-socket-utils", () => ({
    SendServerRequestToSessionServer: vi.fn(),
}));
vi.mock("@/api-server/db-event-history", () => ({
    DbEventHistory: { add: vi.fn(async () => undefined) },
    UNKNOWN_ORIGIN: { initiator: "unknown" },
}));

import { DbEvent } from "@/api-server/db-event";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { MessageTypes } from "@/settings";

function makeController(overrides: Partial<{
    updateOne: ReturnType<typeof vi.fn>;
    insertOne: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
}> = {}) {
    return {
        events: {
            findOne: overrides.findOne ?? vi.fn(async () => null),
            insertOne: overrides.insertOne ?? vi.fn(async () => ({ acknowledged: true })),
            updateOne:
                overrides.updateOne ?? vi.fn(async () => ({ matchedCount: 1, modifiedCount: 1 })),
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("DbEvent.create broadcasts", () => {
    it("broadcasts EVENT_ADDED_OR_REMOVED scoped to the event's iteration", async () => {
        const controller = makeController();
        await DbEvent.create(
            {
                id: "e1",
                name: "שיעור",
                startTime: new Date("2026-09-10T08:00:00.000Z"),
                endTime: new Date("2026-09-10T09:00:00.000Z"),
            } as never,
            undefined,
            controller as never,
            "2026a",
        );

        expect(SendServerRequestToSessionServer).toHaveBeenCalledTimes(1);
        const [ type, data, targets ] = vi.mocked(SendServerRequestToSessionServer).mock
            .calls[0]!;
        expect(type).toBe(MessageTypes.EVENT_ADDED_OR_REMOVED);
        expect(data).toMatchObject({ action: "added", eventId: "e1" });
        expect(targets).toBe("iteration:2026a");
    });

    it("scopes to the current-run sync id when no iteration is given", async () => {
        const controller = makeController();
        await DbEvent.create({ id: "e2", name: "שיעור" } as never, undefined, controller as never);

        const [ , , targets ] = vi.mocked(SendServerRequestToSessionServer).mock.calls[0]!;
        expect(targets).toBe("iteration:current");
    });
});

describe("DbEvent.set (update, including move/resize) broadcasts", () => {
    it("broadcasts the new start/end time for a pure drag-to-reschedule", async () => {
        // No other field changes -- exactly what a drag or resize sends.
        const before = {
            id: "e1",
            name: "שיעור",
            startTime: new Date("2026-09-10T08:00:00.000Z"),
            endTime: new Date("2026-09-10T09:00:00.000Z"),
        };
        const controller = makeController({ findOne: vi.fn(async () => before) });

        await DbEvent.set(
            {
                ...before,
                startTime: new Date("2026-09-10T10:00:00.000Z"),
                endTime: new Date("2026-09-10T11:00:00.000Z"),
            } as never,
            undefined,
            controller as never,
            "2026a",
        );

        expect(SendServerRequestToSessionServer).toHaveBeenCalledTimes(1);
        const [ type, data, targets ] = vi.mocked(SendServerRequestToSessionServer).mock
            .calls[0]!;
        expect(type).toBe(MessageTypes.EVENT_DATA_UPDATE);
        expect(targets).toBe("iteration:2026a");

        const broadcastEvent = (data as { events: Record<string, { startTime: unknown; endTime: unknown }> })
            .events["e1"]!;
        expect(new Date(broadcastEvent.startTime as string).toISOString()).toBe(
            "2026-09-10T10:00:00.000Z",
        );
        expect(new Date(broadcastEvent.endTime as string).toISOString()).toBe(
            "2026-09-10T11:00:00.000Z",
        );
    });

    it("throws instead of broadcasting when the event does not exist", async () => {
        const controller = makeController({
            updateOne: vi.fn(async () => ({ matchedCount: 0, modifiedCount: 0 })),
        });

        await expect(
            DbEvent.set({ id: "missing" } as never, undefined, controller as never),
        ).rejects.toThrow();
        expect(SendServerRequestToSessionServer).not.toHaveBeenCalled();
    });
});

describe("DbEvent.del broadcasts", () => {
    it("broadcasts a removal scoped to the event's iteration", async () => {
        const controller = makeController();
        await DbEvent.del("e1", undefined, controller as never, "2026a");

        expect(SendServerRequestToSessionServer).toHaveBeenCalledWith(
            MessageTypes.EVENT_ADDED_OR_REMOVED,
            expect.objectContaining({ action: "removed", eventId: "e1" }),
            "iteration:2026a",
        );
    });

    it("throws instead of broadcasting when the event does not exist", async () => {
        const controller = makeController({
            updateOne: vi.fn(async () => ({ matchedCount: 0, modifiedCount: 0 })),
        });

        await expect(
            DbEvent.del("missing", undefined, controller as never),
        ).rejects.toThrow();
        expect(SendServerRequestToSessionServer).not.toHaveBeenCalled();
    });
});
