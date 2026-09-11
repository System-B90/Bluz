import { describe, it, expect, vi, beforeEach } from "vitest";

// The session-server broadcast is a network side effect; stub it out.
vi.mock("@/api-server/web-socket-utils", () => ({
    // The student refresh ping (#656) is a second network side effect on the
    // same write paths; stubbed alongside the broadcast.
    NotifyStudentsOfCalendarChange: vi.fn(),
    SendServerRequestToSessionServer: vi.fn(),
}));

import { DbEvent, DbEventDocument } from "@/api-server/db-event";
import { DatabaseController } from "@/api-server/mongo-db-controller";

type MockController = {
    events: {
        findOne: ReturnType<typeof vi.fn>;
        find: ReturnType<typeof vi.fn>;
        updateOne: ReturnType<typeof vi.fn>;
        deleteOne: ReturnType<typeof vi.fn>;
    };
};

function makeController(): MockController {
    return {
        events: {
            findOne: vi.fn(async () => null),
            find: vi.fn(() => {
                const cursor = {
                    limit: vi.fn(() => cursor),
                    toArray: async () => [],
                };
                return cursor;
            }),
            updateOne: vi.fn(async () => ({ matchedCount: 1 })),
            deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
        },
    };
}

let controller: MockController;
beforeEach(() => {
    controller = makeController();
});

describe("DbEvent soft delete (#63)", () => {
    it("archives instead of hard-deleting the document", async () => {
        await DbEvent.del("e1", undefined, controller as unknown as DatabaseController);

        expect(controller.events.deleteOne).not.toHaveBeenCalled();
        expect(controller.events.updateOne).toHaveBeenCalledTimes(1);
        const [filter, update] = controller.events.updateOne.mock.calls[0];
        expect(filter).toMatchObject({ id: "e1" });
        expect(update).toEqual({ $set: { archived: true } });
    });

    it("throws when no live event matches (already archived / missing)", async () => {
        controller.events.updateOne.mockResolvedValueOnce({ matchedCount: 0 });
        await expect(
            DbEvent.del("ghost", undefined, controller as unknown as DatabaseController),
        ).rejects.toThrow();
    });

    it("excludes archived events from a single-event read", async () => {
        await DbEvent.get("e1", undefined, controller as unknown as DatabaseController);
        const [filter] = controller.events.findOne.mock.calls[0];
        expect(filter).toMatchObject({ id: "e1", archived: { $ne: true } });
    });

    it("excludes archived events from a multi-event read", async () => {
        await DbEvent.getMultiple(["e1", "e2"], undefined, controller as unknown as DatabaseController);
        const [filter] = controller.events.find.mock.calls[0];
        expect(filter).toMatchObject({ archived: { $ne: true } });
    });

    it("excludes archived events from a range read", async () => {
        await DbEvent.getInRange(
            new Date("2026-01-01"),
            new Date("2026-01-31"),
            undefined,
            undefined,
            controller as unknown as DatabaseController,
        );
        const [filter] = controller.events.find.mock.calls[0];
        expect(filter).toMatchObject({ archived: { $ne: true } });
    });

    it("excludes archived events from update (cannot revive via edit)", async () => {
        await DbEvent.set(
            { id: "e1" } as Partial<DbEventDocument> as DbEventDocument,
            undefined,
            controller as unknown as DatabaseController,
        );
        const [filter] = controller.events.updateOne.mock.calls[0];
        expect(filter).toMatchObject({ id: "e1", archived: { $ne: true } });
    });
});
