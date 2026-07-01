import { describe, it, expect, vi, beforeEach } from "vitest";

import { DbCalendarDraft } from "@/api-server/db-calendar-draft";

function makeController() {
    const cursor = {
        sort: vi.fn(() => cursor),
        toArray: vi.fn(async () => []),
    };
    return {
        cursor,
        calendarDrafts: {
            insertOne: vi.fn(async () => ({ insertedId: "x" })),
            find: vi.fn(() => cursor),
            findOne: vi.fn(async () => null),
            findOneAndUpdate: vi.fn(async () => null),
            deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
        },
    };
}

const author = { id: "u1", displayName: "מיכאל" };
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

describe("DbCalendarDraft (#62)", () => {
    it("creates a shared draft stamped with the author and counts", async () => {
        const summary = await DbCalendarDraft.create(
            "  Plan A  ",
            [sampleEvent],
            author,
            controller as never,
        );

        expect(controller.calendarDrafts.insertOne).toHaveBeenCalledTimes(1);
        const [doc] = controller.calendarDrafts.insertOne.mock.calls[0];
        expect(doc).toMatchObject({
            label: "Plan A",
            updatedBy: "מיכאל",
            updatedById: "u1",
            eventCount: 1,
        });
        expect(doc.createdAt).toBe(doc.updatedAt);
        expect(summary.eventCount).toBe(1);
        expect(summary).not.toHaveProperty("events");
    });

    it("does not throw when the summary's events list is missing", async () => {
        const summary = await DbCalendarDraft.create(
            "No events",
            undefined as never,
            author,
            controller as never,
        );
        expect(summary.eventCount).toBe(0);
    });

    it("rejects a blank label on create", async () => {
        await expect(
            DbCalendarDraft.create("  ", [], author, controller as never),
        ).rejects.toThrow();
    });

    it("updates an existing draft, re-stamping the editor", async () => {
        controller.calendarDrafts.findOneAndUpdate.mockResolvedValueOnce({
            id: "d1",
            label: "Plan A",
            createdAt: "2026-06-01T00:00:00.000Z",
            updatedAt: "2026-06-28T09:00:00.000Z",
            updatedBy: "מיכאל",
            updatedById: "u1",
        });
        const summary = await DbCalendarDraft.update(
            "d1",
            [sampleEvent],
            author,
            controller as never,
        );

        const [filter, update] =
            controller.calendarDrafts.findOneAndUpdate.mock.calls[0];
        expect(filter).toEqual({ id: "d1" });
        expect(update.$set).toMatchObject({
            updatedBy: "מיכאל",
            eventCount: 1,
        });
        expect(summary.eventCount).toBe(1);
    });

    it("throws when updating a missing draft", async () => {
        controller.calendarDrafts.findOneAndUpdate.mockResolvedValueOnce(null);
        await expect(
            DbCalendarDraft.update("ghost", [], author, controller as never),
        ).rejects.toThrow();
    });

    it("lists drafts newest-updated-first with events projected out", async () => {
        controller.cursor.toArray.mockResolvedValueOnce([
            {
                id: "d1",
                label: "A",
                createdAt: "2026-06-01T00:00:00.000Z",
                updatedAt: "2026-06-28T09:00:00.000Z",
                updatedBy: "מיכאל",
                eventCount: 2,
            },
        ]);
        const list = await DbCalendarDraft.list(controller as never);
        expect(controller.calendarDrafts.find).toHaveBeenCalledWith(
            {},
            { projection: { events: 0, _id: 0 } },
        );
        expect(controller.cursor.sort).toHaveBeenCalledWith({ updatedAt: -1 });
        expect(list[0]).toMatchObject({ id: "d1", eventCount: 2 });
    });

    it("scopes the listing to the given iteration", async () => {
        await DbCalendarDraft.list(controller as never, "it1" as never);
        expect(controller.calendarDrafts.find).toHaveBeenCalledWith(
            { iterationId: "it1" },
            { projection: { events: 0, _id: 0 } },
        );
    });

    it("throws when deleting a missing draft", async () => {
        controller.calendarDrafts.deleteOne.mockResolvedValueOnce({
            deletedCount: 0,
        });
        await expect(
            DbCalendarDraft.del("nope", controller as never),
        ).rejects.toThrow();
    });
});
