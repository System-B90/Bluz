import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/api-server/db-iterations", () => ({
    DbIterations: {
        list: vi.fn(),
        current: vi.fn(),
        get: vi.fn(),
        register: vi.fn(),
        patch: vi.fn(),
    },
}));

// Stub the Hive client so the route's name-cache snapshot runs without a real
// Hive instance (and without pulling NextAuth/sso into the test).
const hiveStub = {
    getModules: vi.fn(async () => [{ id: "10", name: "מודול א" }]),
    getSubjects: vi.fn(async () => [
        { id: "20", name: "subj", displayName: "מקצוע ב" },
    ]),
    getRooms: vi.fn(async () => [{ id: 30, name: "חדר ג" }]),
};
vi.mock("@/api-server/hive/session-client", () => ({
    createHiveClient: vi.fn(async () => hiveStub),
}));

import { DbIterations } from "@/api-server/db-iterations";
import { Iteration } from "@/api-shared/types/iteration";
import * as IterationsRoute from "@/app/api/iterations/route";
import * as CurrentRoute from "@/app/api/iterations/current/route";
import * as IterationByIdRoute from "@/app/api/iterations/[id]/route";

beforeEach(() => vi.clearAllMocks());

const sample: Iteration = {
    id: "2026b",
    label: "B",
    dbName: "bluz_2026b",
    isCurrent: false,
    startDate: new Date(),
    endDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};

describe("GET /api/iterations", () => {
    it("returns the registry list", async () => {
        vi.mocked(DbIterations.list).mockResolvedValueOnce([sample]);
        const res = await IterationsRoute.GET(
            new NextRequest("http://localhost/api/iterations"),
        );
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
    });
});

describe("POST /api/iterations", () => {
    it("registers a new iteration", async () => {
        vi.mocked(DbIterations.register).mockResolvedValueOnce(sample);
        const req = new NextRequest("http://localhost/api/iterations", {
            method: "POST",
            body: JSON.stringify({ id: "2026b", label: "B" }),
        });
        const res = await IterationsRoute.POST(req);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data.id).toBe("2026b");
        expect(DbIterations.register).toHaveBeenCalledWith(
            expect.objectContaining({ id: "2026b", label: "B" }),
        );
    });

    it("snapshots Hive module/subject/room names into the cache", async () => {
        vi.mocked(DbIterations.register).mockResolvedValueOnce(sample);
        const req = new NextRequest("http://localhost/api/iterations", {
            method: "POST",
            body: JSON.stringify({
                id: "2026b",
                label: "B",
                hiveUrl: "https://hive-2026b.example",
            }),
        });
        await IterationsRoute.POST(req);

        const passed = vi.mocked(DbIterations.register).mock.calls[0][0];
        expect(passed.hiveCache?.modules).toEqual({ "10": "מודול א" });
        expect(passed.hiveCache?.subjects).toEqual({ "20": "מקצוע ב" });
        expect(passed.hiveCache?.rooms).toEqual({ "30": "חדר ג" });
        expect(passed.hiveCache?.cachedAt).toBeTruthy();
    });

    it("rejects a payload missing id/label", async () => {
        const req = new NextRequest("http://localhost/api/iterations", {
            method: "POST",
            body: JSON.stringify({ label: "no id" }),
        });
        const res = await IterationsRoute.POST(req);
        expect(res.status).toBe(400);
        expect(DbIterations.register).not.toHaveBeenCalled();
    });
});

describe("GET /api/iterations/current", () => {
    it("returns the current iteration", async () => {
        vi.mocked(DbIterations.current).mockResolvedValueOnce({
            ...sample,
            isCurrent: true,
        });
        const res = await CurrentRoute.GET(
            new NextRequest("http://localhost/api/iterations/current"),
        );
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data.isCurrent).toBe(true);
    });
});

describe("PATCH /api/iterations/[id]", () => {
    it("patches an iteration", async () => {
        vi.mocked(DbIterations.patch).mockResolvedValueOnce({
            ...sample,
            isCurrent: true,
        });
        const req = new NextRequest("http://localhost/api/iterations/2026b", {
            method: "PATCH",
            body: JSON.stringify({ isCurrent: true }),
        });
        const res = await IterationByIdRoute.PATCH(req, {
            params: Promise.resolve({ id: "2026b" }),
        });
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data.isCurrent).toBe(true);
        expect(DbIterations.patch).toHaveBeenCalledWith("2026b", {
            isCurrent: true,
        });
    });
});
