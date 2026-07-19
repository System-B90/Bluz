import { NextRequest } from "next/server";
import { beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("@/api-server/db-rooms", () => ({
    DbRooms: { set: vi.fn(), create: vi.fn(), del: vi.fn() },
}));
vi.mock("@/api-server/db-room-extended-info", () => ({
    DbRoomExtendedInfo: { upsert: vi.fn() },
}));
vi.mock("@/app/api/rooms/utils", () => ({ getAllRooms: vi.fn() }));

const { resolveIterationDb } = vi.hoisted(() => ({
    resolveIterationDb: vi.fn(async (id?: string) => ({
        dbName: id ? `db_${id}` : "current",
    })),
}));
vi.mock("@/api-server/mongo-db-controller", () => ({ resolveIterationDb }));

vi.mock("@/api-server/db-iterations", () => ({
    DbIterations: {
        get: vi.fn(),
        assertWritable: vi.fn(async () => undefined),
    },
}));

import { DbIterations } from "@/api-server/db-iterations";
import { Iteration } from "@/api-shared/types/iteration";
import { getAllRooms } from "@/app/api/rooms/utils";
import * as RoomsRoute from "@/app/api/rooms/route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/rooms — per-iteration Hive instance", () => {
    it("uses the iteration's Hive URL when viewing a past iteration", async () => {
        vi.mocked(getAllRooms).mockResolvedValueOnce([]);
        const hiveCache = {
            modules: {},
            subjects: {},
            rooms: { "30": "חדר ג" },
            cachedAt: "2026-06-27T00:00:00.000Z",
        };
        vi.mocked(DbIterations.get).mockResolvedValueOnce({
            id: "2026b",
            hiveUrl: "https://hive-2026b.example",
            hiveCache,
        } as Iteration);

        const req = new NextRequest("http://localhost/api/rooms?it=2026b");
        const res = await RoomsRoute.GET(req);

        expect(res.status).toBe(200);
        expect(DbIterations.get).toHaveBeenCalledWith("2026b");
        expect(getAllRooms).toHaveBeenCalledWith(
            expect.anything(),
            "https://hive-2026b.example",
            hiveCache,
        );
    });

    it("uses the default Hive instance for the current run", async () => {
        vi.mocked(getAllRooms).mockResolvedValueOnce([]);

        const req = new NextRequest("http://localhost/api/rooms");
        const res = await RoomsRoute.GET(req);

        expect(res.status).toBe(200);
        expect(DbIterations.get).not.toHaveBeenCalled();
        expect(getAllRooms).toHaveBeenCalledWith(
            expect.anything(),
            undefined,
            undefined,
        );
    });
});
