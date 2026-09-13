import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// The routes exercised below are staff-gated. Bypass requireStaffSession()'s
// getServerSession() call, which touches next/headers outside a request scope
// in vitest — same shim as base-gantt.test.ts (#223).
vi.mock("next-auth", async () => {
    const { Clearance } = await import("@/api-shared/types/hive");
    return {
        default: vi.fn(() => vi.fn()),
        getServerSession: vi.fn(async () => ({
            user: {
                id: "test-user",
                display_name: "Test User",
                clearance: Clearance.Admin,
            },
        })),
    };
});

vi.mock("@/api-server/hive/sso", () => ({
    authOptions: {},
}));

vi.mock("@/api-server/db-iterations", () => ({
    DbIterations: {
        assertWritable: vi.fn(),
        get: vi.fn(),
        setHiveCache: vi.fn(),
    },
}));

// Stub the Hive client so the re-snapshot runs without a live Hive instance.
const hiveStub = {
    getModules: vi.fn(async () => [
        { id: "10", name: "מודול א" },
        { id: "11", name: "מודול חדש" },
    ]),
    getSubjects: vi.fn(async () => [
        { id: "20", name: "מקצוע ב" },
    ]),
    getRooms: vi.fn(async () => [{ id: 30, name: "חדר ג" }]),
};
vi.mock("@/api-server/hive/session-client", () => ({
    createHiveClient: vi.fn(async () => hiveStub),
}));

import { DbIterations } from "@/api-server/db-iterations";
import { diffHiveCache } from "@/api-server/hive/build-cache";
import { ClientApiError } from "@/api-shared/errors";
import { Iteration } from "@/api-shared/types/iteration";
import * as SyncHiveRoute from "@/app/api/iterations/[id]/sync-hive/route";

beforeEach(() => vi.clearAllMocks());

const current: Iteration = {
    id: "2026b",
    label: "B",
    dbName: "bluz_2026b",
    hiveUrl: "https://hive-2026b.example",
    hiveCache: {
        modules: { "10": "מודול ישן" },
        subjects: { "20": "מקצוע ב" },
        rooms: { "30": "חדר ג", "31": "חדר שנמחק" },
        cachedAt: "2026-01-01T00:00:00.000Z",
    },
    isCurrent: true,
    startDate: new Date(),
    endDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};

function post(id: string) {
    return SyncHiveRoute.POST(
        new NextRequest(`http://localhost/api/iterations/${id}/sync-hive`, {
            method: "POST",
        }),
        { params: Promise.resolve({ id }) },
    );
}

describe("POST /api/iterations/[id]/sync-hive", () => {
    it("re-snapshots Hive names into the iteration cache", async () => {
        vi.mocked(DbIterations.get).mockResolvedValueOnce(current);
        vi.mocked(DbIterations.setHiveCache).mockResolvedValueOnce(current);

        const res = await post("2026b");
        const body = await res.json();

        expect(res.status).toBe(200);
        const [id, cache] = vi.mocked(DbIterations.setHiveCache).mock.calls[0];
        expect(id).toBe("2026b");
        expect(cache.modules).toEqual({ "10": "מודול א", "11": "מודול חדש" });
        expect(cache.rooms).toEqual({ "30": "חדר ג" });
        expect(cache.cachedAt).toBeTruthy();
        expect(body.data.changes).toEqual({
            added: 1,
            removed: 1,
            unchanged: 2,
            updated: 1,
        });
    });

    it("rejects a sync into a past iteration and never writes", async () => {
        vi.mocked(DbIterations.assertWritable).mockRejectedValueOnce(
            new ClientApiError("read only"),
        );

        const res = await post("2025a");

        expect(res.status).toBe(400);
        expect(DbIterations.setHiveCache).not.toHaveBeenCalled();
    });

    it("rejects an iteration with no Hive URL", async () => {
        vi.mocked(DbIterations.get).mockResolvedValueOnce({
            ...current,
            hiveUrl: undefined,
        });

        const res = await post("2026b");

        expect(res.status).toBe(400);
        expect(DbIterations.setHiveCache).not.toHaveBeenCalled();
    });

    it("rejects an unknown iteration", async () => {
        vi.mocked(DbIterations.get).mockResolvedValueOnce(null);

        const res = await post("nope");

        expect(res.status).toBe(400);
        expect(DbIterations.setHiveCache).not.toHaveBeenCalled();
    });
});

describe("diffHiveCache", () => {
    it("counts a first-ever snapshot as all added", () => {
        expect(
            diffHiveCache(undefined, {
                modules: { "1": "a" },
                subjects: {},
                rooms: { "2": "b" },
                cachedAt: "now",
            }),
        ).toEqual({ added: 2, removed: 0, unchanged: 0, updated: 0 });
    });

    it("reports no changes when the cache already matches", () => {
        const cache = {
            modules: { "1": "a" },
            subjects: { "2": "b" },
            rooms: { "3": "c" },
            cachedAt: "then",
        };
        expect(diffHiveCache(cache, { ...cache, cachedAt: "now" })).toEqual({
            added: 0,
            removed: 0,
            unchanged: 3,
            updated: 0,
        });
    });
});
