import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// `vi.mock` factories are hoisted above module scope, so the stub controller
// has to be created inside `vi.hoisted` to exist by the time they run.
const { fakeController } = vi.hoisted(() => ({
    fakeController: { dbName: "stub" },
}));

vi.mock("@/api-server/mongo-db-controller", () => ({
    databaseController: fakeController,
    getMetaController: vi.fn(),
    resolveIterationDb: vi.fn(async () => fakeController),
    resolveWritableIterationDb: vi.fn(async () => fakeController),
}));

vi.mock("@/api-server/db-iterations", () => ({
    DbIterations: { get: vi.fn() },
}));

vi.mock("@/app/api/rooms/utils", () => ({
    getAllRooms: vi.fn(async () => [{ id: 1, name: "חדר ג" }]),
}));

import { DbIterations } from "@/api-server/db-iterations";
import { archivedIterationCacheControl } from "@/api-server/iteration-request";
import { Iteration } from "@/api-shared/types/iteration";
import * as RoomsRoute from "@/app/api/rooms/route";
import { ARCHIVED_HIVE_CACHE_TTL } from "@/settings";

beforeEach(() => vi.clearAllMocks());

const archived: Iteration = {
    id: "2025a",
    label: "A",
    dbName: "bluz_2025a",
    hiveUrl: "https://hive-2025a.example",
    isCurrent: false,
    startDate: new Date(),
    endDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};

describe("archivedIterationCacheControl", () => {
    it("caches an archived iteration privately for 7 days", () => {
        expect(ARCHIVED_HIVE_CACHE_TTL).toBe(7 * 24 * 60 * 60);
        expect(archivedIterationCacheControl(archived)).toEqual({
            maxAge: ARCHIVED_HIVE_CACHE_TTL,
            scope: "private",
        });
    });

    it("never caches the current iteration — it is live data", () => {
        expect(
            archivedIterationCacheControl({ ...archived, isCurrent: true }),
        ).toBeUndefined();
        expect(archivedIterationCacheControl(null)).toBeUndefined();
    });
});

describe("GET /api/rooms — archived iteration caching", () => {
    it("serves a past iteration's rooms with a 7-day private cache", async () => {
        vi.mocked(DbIterations.get).mockResolvedValueOnce(archived);

        const res = await RoomsRoute.GET(
            new NextRequest("http://localhost/api/rooms?it=2025a"),
        );

        expect(res.headers.get("Cache-Control")).toBe(
            `private, max-age=${ARCHIVED_HIVE_CACHE_TTL}, immutable`,
        );
    });

    it("leaves the current iteration's rooms uncached", async () => {
        const res = await RoomsRoute.GET(
            new NextRequest("http://localhost/api/rooms"),
        );

        expect(res.headers.get("Cache-Control")).toBeNull();
        expect(DbIterations.get).not.toHaveBeenCalled();
    });

    it("does not cache when an explicitly named iteration is the current one", async () => {
        vi.mocked(DbIterations.get).mockResolvedValueOnce({
            ...archived,
            isCurrent: true,
        });

        const res = await RoomsRoute.GET(
            new NextRequest("http://localhost/api/rooms?it=2026b"),
        );

        expect(res.headers.get("Cache-Control")).toBeNull();
    });
});
