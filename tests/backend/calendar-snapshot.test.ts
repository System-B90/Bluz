import { describe, it, expect, vi, beforeEach } from "vitest";

import { DbCalendarSnapshot } from "@/api-server/db-calendar-snapshot";

function makeController(overrides: Record<string, unknown> = {}) {
    const cursor = {
        sort: vi.fn(() => cursor),
        toArray: vi.fn(async () => []),
    };
    return {
        cursor,
        calendarSnapshots: {
            insertOne: vi.fn(async () => ({ insertedId: "x" })),
            find: vi.fn(() => cursor),
            findOne: vi.fn(async () => null),
            deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
            ...overrides,
        },
    };
}

const sampleEvent = {
    id: "e1",
    name: "Lecture",
    startTime: "2026-06-28T09:00:00.000Z",
    endTime: "2026-06-28T10:00:00.000Z",
} as never;

let controller: ReturnType<typeof makeController>;
beforeEach(() => {
    controller = makeController();
});

describe("DbCalendarSnapshot (#61)", () => {
    it("creates a snapshot with a generated id, timestamp and denormalized count", async () => {
        const summary = await DbCalendarSnapshot.create(
            "  Before reshuffle  ",
            [sampleEvent],
            controller as never,
        );

        expect(controller.calendarSnapshots.insertOne).toHaveBeenCalledTimes(1);
        const [doc] = controller.calendarSnapshots.insertOne.mock.calls[0];
        expect(doc).toMatchObject({
            label: "Before reshuffle", // trimmed
            eventCount: 1,
        });
        expect(typeof doc.id).toBe("string");
        expect(typeof doc.createdAt).toBe("string");
        // Server-side, captured event times are normalized to Date objects.
        expect(doc.events[0].startTime).toBeInstanceOf(Date);

        expect(summary.eventCount).toBe(1);
        expect(summary).not.toHaveProperty("events");
    });

    it("rejects a blank label", async () => {
        await expect(
            DbCalendarSnapshot.create("   ", [], controller as never),
        ).rejects.toThrow();
    });

    it("lists snapshots newest-first with events projected out", async () => {
        controller.cursor.toArray.mockResolvedValueOnce([
            {
                id: "s1",
                label: "A",
                createdAt: "2026-06-28T09:00:00.000Z",
                eventCount: 3,
            },
        ]);
        const list = await DbCalendarSnapshot.list(controller as never);

        expect(controller.calendarSnapshots.find).toHaveBeenCalledWith(
            {},
            { projection: { events: 0, _id: 0 } },
        );
        expect(controller.cursor.sort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(list).toEqual([
            {
                id: "s1",
                label: "A",
                createdAt: "2026-06-28T09:00:00.000Z",
                iterationId: undefined,
                eventCount: 3,
            },
        ]);
    });

    it("fetches a single snapshot including normalized events", async () => {
        controller.calendarSnapshots.findOne.mockResolvedValueOnce({
            id: "s1",
            label: "A",
            createdAt: "2026-06-28T09:00:00.000Z",
            events: [sampleEvent],
        });
        const snap = await DbCalendarSnapshot.get("s1", controller as never);
        expect(snap.id).toBe("s1");
        expect(snap.events[0].startTime).toBeInstanceOf(Date);
    });

    it("throws when fetching a missing snapshot", async () => {
        await expect(
            DbCalendarSnapshot.get("nope", controller as never),
        ).rejects.toThrow();
    });

    it("throws when deleting a missing snapshot", async () => {
        controller.calendarSnapshots.deleteOne.mockResolvedValueOnce({
            deletedCount: 0,
        });
        await expect(
            DbCalendarSnapshot.del("nope", controller as never),
        ).rejects.toThrow();
    });
});
