import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api-server/mongo-db-controller", () => ({
    databaseController: {},
}));

vi.mock("@/api-server/mongo-transactions", () => ({
    // Run the body directly; the transaction wrapper is covered elsewhere.
    withOptionalTransaction: vi.fn(async (_client, fn) => await fn(undefined)),
}));

import { DbReservations } from "@/api-server/db-reservations";
import { ClientApiError } from "@/api-shared/errors";

function makeController(conflict: unknown = null) {
    return {
        client: {},
        reservations: {
            find: vi.fn(() => ({ toArray: vi.fn(async () => []) })),
            findOne: vi.fn(async () => conflict),
            insertOne: vi.fn(async () => ({ insertedId: "res-1" })),
        },
    };
}

function reservation(start: string, end: string) {
    return {
        roomId: "room-1",
        roomSource: "custom",
        start,
        end,
        reserverType: "instructor",
        reserverId: "user-1",
    } as never;
}

describe("#568 — reservation range validation", () => {
    let controller: ReturnType<typeof makeController>;

    beforeEach(() => {
        controller = makeController();
    });

    it("rejects a reservation whose end precedes its start", async () => {
        await expect(
            DbReservations.create(
                reservation("2026-09-01T12:00:00Z", "2026-09-01T10:00:00Z"),
                controller as never,
            ),
        ).rejects.toBeInstanceOf(ClientApiError);
    });

    it("rejects a zero-length reservation", async () => {
        await expect(
            DbReservations.create(
                reservation("2026-09-01T10:00:00Z", "2026-09-01T10:00:00Z"),
                controller as never,
            ),
        ).rejects.toBeInstanceOf(ClientApiError);
    });

    it("does not reach the database for an invalid range", async () => {
        // The point of the bug: an inverted range satisfies neither half of the
        // overlap predicate, so it would be stored and then conflict with
        // nothing -- the room reads free for a slot shown as booked.
        await expect(
            DbReservations.create(
                reservation("2026-09-01T12:00:00Z", "2026-09-01T10:00:00Z"),
                controller as never,
            ),
        ).rejects.toThrow();

        expect(controller.reservations.findOne).not.toHaveBeenCalled();
        expect(controller.reservations.insertOne).not.toHaveBeenCalled();
    });

    it("accepts a well-ordered reservation", async () => {
        const created = await DbReservations.create(
            reservation("2026-09-01T10:00:00Z", "2026-09-01T12:00:00Z"),
            controller as never,
        );

        expect(controller.reservations.insertOne).toHaveBeenCalled();
        expect(created._id).toBe("res-1");
    });

    it("still rejects a genuine overlap", async () => {
        const withConflict = makeController({ _id: "existing" });

        await expect(
            DbReservations.create(
                reservation("2026-09-01T10:00:00Z", "2026-09-01T12:00:00Z"),
                withConflict as never,
            ),
        ).rejects.toBeInstanceOf(ClientApiError);
        expect(withConflict.reservations.insertOne).not.toHaveBeenCalled();
    });
});

describe("#568 — from/to filtering uses an overlap predicate", () => {
    it("includes reservations that started before the window but run into it", async () => {
        const controller = makeController();

        await DbReservations.get(
            undefined,
            undefined,
            "2026-09-01T10:00:00Z",
            "2026-09-01T12:00:00Z",
            controller as never,
        );

        // start < to AND end > from -- the same shape as the conflict check.
        // Filtering on `start` alone excluded a reservation already running
        // when the window opened.
        expect(controller.reservations.find).toHaveBeenCalledWith({
            start: { $lt: "2026-09-01T12:00:00Z" },
            end: { $gt: "2026-09-01T10:00:00Z" },
        });
    });

    it("bounds only one side when a single endpoint is given", async () => {
        const controller = makeController();

        await DbReservations.get(
            undefined,
            undefined,
            "2026-09-01T10:00:00Z",
            undefined,
            controller as never,
        );

        expect(controller.reservations.find).toHaveBeenCalledWith({
            end: { $gt: "2026-09-01T10:00:00Z" },
        });
    });

    it("does not filter by time when neither endpoint is given", async () => {
        const controller = makeController();

        await DbReservations.get(
            "room-1",
            undefined,
            undefined,
            undefined,
            controller as never,
        );

        expect(controller.reservations.find).toHaveBeenCalledWith({
            roomId: "room-1",
        });
    });
});
