import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// The iteration write routes are staff-gated. Bypass requireStaffSession()'s
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
        list: vi.fn(),
        current: vi.fn(),
        currentOrNull: vi.fn(),
        get: vi.fn(),
        usage: vi.fn(),
        register: vi.fn(),
        patch: vi.fn(),
        remove: vi.fn(),
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
import * as UsageRoute from "@/app/api/iterations/[id]/usage/route";

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
        vi.mocked(DbIterations.currentOrNull).mockResolvedValueOnce({
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

    // A fresh install has no iteration yet; the UI prompts for one (#471), so
    // an empty registry is data, not an error.
    it("returns null when no iteration has been created yet", async () => {
        vi.mocked(DbIterations.currentOrNull).mockResolvedValueOnce(null);
        const res = await CurrentRoute.GET(
            new NextRequest("http://localhost/api/iterations/current"),
        );
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data).toBeNull();
    });
});

// The literal iteration id "current" collides with this static route segment,
// so writes aimed at it used to land on whichever iteration happened to be
// current — "make current" then promoted the wrong row (#472).
describe("PATCH /api/iterations/current", () => {
    it("patches the iteration literally named \"current\"", async () => {
        vi.mocked(DbIterations.get).mockResolvedValueOnce({
            ...sample,
            id: "current",
        });
        vi.mocked(DbIterations.patch).mockResolvedValueOnce({
            ...sample,
            id: "current",
            isCurrent: true,
        });
        const res = await CurrentRoute.PATCH(
            new NextRequest("http://localhost/api/iterations/current", {
                method: "PATCH",
                body: JSON.stringify({ isCurrent: true }),
            }),
        );
        expect(res.status).toBe(200);
        expect(DbIterations.patch).toHaveBeenCalledWith("current", {
            isCurrent: true,
        });
        expect(DbIterations.current).not.toHaveBeenCalled();
    });

    it("falls back to the resolved current iteration when no such id exists", async () => {
        vi.mocked(DbIterations.get).mockResolvedValueOnce(null);
        vi.mocked(DbIterations.current).mockResolvedValueOnce({
            ...sample,
            isCurrent: true,
        });
        vi.mocked(DbIterations.patch).mockResolvedValueOnce(sample);
        const res = await CurrentRoute.PATCH(
            new NextRequest("http://localhost/api/iterations/current", {
                method: "PATCH",
                body: JSON.stringify({ label: "renamed" }),
            }),
        );
        expect(res.status).toBe(200);
        expect(DbIterations.patch).toHaveBeenCalledWith("2026b", {
            label: "renamed",
        });
    });
});

describe("GET /api/iterations/[id]/usage", () => {
    it("reports what the iteration still owns", async () => {
        vi.mocked(DbIterations.usage).mockResolvedValueOnce({
            curriculums: 0,
            events: 0,
            isCurrent: false,
            orphaned: true,
        });
        const res = await UsageRoute.GET(
            new NextRequest("http://localhost/api/iterations/2026b/usage"),
            { params: Promise.resolve({ id: "2026b" }) },
        );
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data.orphaned).toBe(true);
        expect(DbIterations.usage).toHaveBeenCalledWith("2026b");
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

describe("DELETE /api/iterations/[id]", () => {
    it("deletes an iteration", async () => {
        vi.mocked(DbIterations.remove).mockResolvedValueOnce(undefined);
        const req = new NextRequest("http://localhost/api/iterations/2026b", {
            method: "DELETE",
        });
        const res = await IterationByIdRoute.DELETE(req, {
            params: Promise.resolve({ id: "2026b" }),
        });
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data.deleted).toBe(true);
        expect(DbIterations.remove).toHaveBeenCalledWith("2026b");
    });
});
