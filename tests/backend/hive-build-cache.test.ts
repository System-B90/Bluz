import { beforeEach, describe, expect, it, vi } from "vitest";

const hive = {
    getModules: vi.fn(),
    getSubjects: vi.fn(),
    getRooms: vi.fn(),
};

vi.mock("@/api-server/hive/session-client", () => ({
    createHiveClient: vi.fn(async () => hive),
}));
vi.mock("@/logging/pino", () => ({
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { buildHiveCache, diffHiveCache } from "@/api-server/hive/build-cache";
import { createHiveClient } from "@/api-server/hive/session-client";
import { HiveIterationCache } from "@/api-shared/types/iteration";

beforeEach(() => {
    vi.clearAllMocks();
    hive.getModules.mockResolvedValue([ { id: 1, name: "מודול" } ]);
    hive.getSubjects.mockResolvedValue([{ id: 2, name: "מקצוע" }]);
    hive.getRooms.mockResolvedValue([ { id: 3, name: "כיתה" } ]);
});

describe("buildHiveCache", () => {
    it("freezes names by id across all three categories", async () => {
        const cache = await buildHiveCache();

        expect(cache).toMatchObject({
            modules: { 1: "מודול" },
            subjects: { 2: "מקצוע" },
            rooms: { 3: "כיתה" },
        });
        expect(typeof cache!.cachedAt).toBe("string");
    });

    it("passes an explicit Hive URL through to the client", async () => {
        await buildHiveCache("https://other.hive");

        expect(createHiveClient).toHaveBeenCalledWith("https://other.hive");
    });

    it("returns undefined rather than throwing when Hive is down", async () => {
        hive.getRooms.mockRejectedValueOnce(new Error("hive down"));

        await expect(buildHiveCache()).resolves.toBeUndefined();
    });
});

describe("diffHiveCache", () => {
    const before = {
        modules: { 1: "מודול", 2: "ישן" },
        subjects: { 5: "מקצוע" },
        rooms: {},
        cachedAt: "2026-03-01T08:00:00.000Z",
    } as unknown as HiveIterationCache;

    it("counts additions, updates, removals and unchanged names", () => {
        const after = {
            modules: { 1: "מודול", 3: "חדש" },
            subjects: { 5: "מקצוע אחר" },
            rooms: {},
            cachedAt: "2026-03-02T08:00:00.000Z",
        } as unknown as HiveIterationCache;

        expect(diffHiveCache(before, after)).toEqual({
            added: 1,
            removed: 1,
            unchanged: 1,
            updated: 1,
        });
    });

    it("counts everything as added against no stored snapshot", () => {
        const after = {
            modules: { 1: "א" },
            subjects: { 2: "ב" },
            rooms: { 3: "ג" },
            cachedAt: "2026-03-02T08:00:00.000Z",
        } as unknown as HiveIterationCache;

        expect(diffHiveCache(undefined, after)).toMatchObject({
            added: 3,
            removed: 0,
            updated: 0,
            unchanged: 0,
        });
    });

    it("reports an identical snapshot as entirely unchanged", () => {
        expect(diffHiveCache(before, before)).toEqual({
            added: 0,
            removed: 0,
            unchanged: 3,
            updated: 0,
        });
    });
});
