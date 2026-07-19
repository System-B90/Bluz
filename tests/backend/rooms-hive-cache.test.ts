import { beforeEach, describe, it, expect, vi } from "vitest";

// Hive client whose getRooms fails — simulating an offline past-iteration Hive.
// Hoisted so the values are available inside the hoisted vi.mock factories.
const { getRooms, fakeController } = vi.hoisted(() => ({
    getRooms: vi.fn(),
    fakeController: {
        rooms: { find: () => ({ toArray: async () => [] }) },
    } as unknown as DatabaseController,
}));

vi.mock("@/api-server/hive/session-client", () => ({
    createHiveClient: vi.fn(async () => ({ getRooms })),
}));

// Stub the per-iteration controller's custom rooms + extended info.
vi.mock("@/api-server/db-room-extended-info", () => ({
    DbRoomExtendedInfo: { getAll: vi.fn(async () => []) },
}));

vi.mock("@/api-server/mongo-db-controller", () => ({
    databaseController: fakeController,
}));

import { getAllRooms } from "@/app/api/rooms/utils";
import { DatabaseController } from "@/api-server/mongo-db-controller";
import { HiveRoom } from "@/api-shared/types/room";

const cache = {
    modules: {},
    subjects: {},
    rooms: { "30": "חדר ג", "31": "חדר ד" },
    cachedAt: "2026-06-27T00:00:00.000Z",
};

beforeEach(() => vi.clearAllMocks());

describe("getAllRooms — Hive cache fallback", () => {
    it("falls back to cached room names when the Hive instance is unreachable", async () => {
        getRooms.mockRejectedValueOnce(new Error("Hive offline"));

        const rooms = await getAllRooms(fakeController, "https://dead", cache);

        expect(rooms).toHaveLength(2);
        const names = rooms.map((r) => (r as HiveRoom).display_name).sort();
        expect(names).toEqual(["חדר ג", "חדר ד"]);
    });

    it("re-throws when Hive fails and no cache is available", async () => {
        getRooms.mockRejectedValueOnce(new Error("Hive offline"));
        await expect(
            getAllRooms(fakeController, "https://dead"),
        ).rejects.toThrow("Hive offline");
    });

    it("uses live Hive rooms when the instance is reachable", async () => {
        getRooms.mockResolvedValueOnce([
            { id: 1, display_name: "Live Room", source: 0 },
        ]);

        const rooms = await getAllRooms(fakeController, undefined, cache);

        expect(rooms).toHaveLength(1);
        expect((rooms[0] as HiveRoom).display_name).toBe("Live Room");
    });
});
