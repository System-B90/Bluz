import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CONTROLLER = { tag: "controller" };

vi.mock("@/api-server/db-calendar-snapshot", () => ({
    DbCalendarSnapshot: {
        list: vi.fn(),
        get: vi.fn(),
        create: vi.fn(),
        del: vi.fn(),
        restore: vi.fn(),
    },
}));
vi.mock("@/api-server/iteration-request", () => ({
    resolveIterationFromRequest: vi.fn(async () => ({
        controller: CONTROLLER,
        iterationId: "2026-a",
    })),
    resolveWritableIterationFromRequest: vi.fn(async () => ({
        controller: CONTROLLER,
        iterationId: "2026-a",
    })),
}));
vi.mock("@/api-server/session-user", () => ({
    requireStaffSession: vi.fn(async () => undefined),
    getSessionUser: vi.fn(async () => ({ id: "u1", displayName: "רכזת" })),
}));

import { DbCalendarSnapshot } from "@/api-server/db-calendar-snapshot";
import {
    resolveIterationFromRequest,
    resolveWritableIterationFromRequest,
} from "@/api-server/iteration-request";
import { requireStaffSession } from "@/api-server/session-user";
import * as RestoreRoute from "@/app/api/calendar/snapshots/restore/route";
import * as SnapshotsRoute from "@/app/api/calendar/snapshots/route";

function request(path: string, method: string, body?: unknown) {
    return new NextRequest(`http://localhost${path}`, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/calendar/snapshots", () => {
    it("lists the iteration's snapshots, uncached", async () => {
        vi.mocked(DbCalendarSnapshot.list).mockResolvedValueOnce([
            { id: "s1" },
        ] as never);

        const response = await SnapshotsRoute.GET(
            request("/api/calendar/snapshots", "GET"),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect(DbCalendarSnapshot.list).toHaveBeenCalledWith(
            CONTROLLER,
            "2026-a",
        );
    });

    it("fetches one snapshot when ?id= is given", async () => {
        vi.mocked(DbCalendarSnapshot.get).mockResolvedValueOnce({} as never);

        await SnapshotsRoute.GET(
            request("/api/calendar/snapshots?id=s1", "GET"),
        );

        expect(DbCalendarSnapshot.get).toHaveBeenCalledWith("s1", CONTROLLER);
        expect(resolveIterationFromRequest).toHaveBeenCalled();
    });
});

describe("POST /api/calendar/snapshots", () => {
    it("captures the posted events with their timestamps as Dates", async () => {
        vi.mocked(DbCalendarSnapshot.create).mockResolvedValueOnce({} as never);

        await SnapshotsRoute.POST(
            request("/api/calendar/snapshots", "POST", {
                label: "לפני החיתוך",
                events: [ { id: "e1", startTime: "2026-03-01T08:00:00.000Z" } ],
            }),
        );

        const [ label, events, controller, iterationId ] = vi.mocked(
            DbCalendarSnapshot.create,
        ).mock.calls[ 0 ];
        expect(label).toBe("לפני החיתוך");
        expect((events[ 0 ] as { startTime: Date }).startTime).toBeInstanceOf(
            Date,
        );
        expect(controller).toBe(CONTROLLER);
        expect(iterationId).toBe("2026-a");
        expect(resolveWritableIterationFromRequest).toHaveBeenCalled();
    });

    it("rejects a snapshot with no label", async () => {
        const response = await SnapshotsRoute.POST(
            request("/api/calendar/snapshots", "POST", { events: [] }),
        );

        expect(response.status).toBe(400);
        expect(DbCalendarSnapshot.create).not.toHaveBeenCalled();
    });

    it("stores an empty capture rather than failing on a non-array events value", async () => {
        vi.mocked(DbCalendarSnapshot.create).mockResolvedValueOnce({} as never);

        await SnapshotsRoute.POST(
            request("/api/calendar/snapshots", "POST", {
                label: "x",
                events: "nope",
            }),
        );

        expect(
            vi.mocked(DbCalendarSnapshot.create).mock.calls[ 0 ][ 1 ],
        ).toEqual([]);
    });
});

describe("DELETE /api/calendar/snapshots", () => {
    it("deletes by ?id=, and rejects a request without one", async () => {
        vi.mocked(DbCalendarSnapshot.del).mockResolvedValueOnce(
            undefined as never,
        );

        expect(
            (
                await SnapshotsRoute.DELETE(
                    request("/api/calendar/snapshots?id=s1", "DELETE"),
                )
            ).status,
        ).toBe(200);
        expect(DbCalendarSnapshot.del).toHaveBeenCalledWith("s1", CONTROLLER);

        expect(
            (
                await SnapshotsRoute.DELETE(
                    request("/api/calendar/snapshots", "DELETE"),
                )
            ).status,
        ).toBe(400);
    });
});

describe("POST /api/calendar/snapshots/restore", () => {
    it("restores into the writable iteration and returns the result", async () => {
        vi.mocked(DbCalendarSnapshot.restore).mockResolvedValueOnce({
            archived: 3,
            restored: 5,
        } as never);

        const response = await RestoreRoute.POST(
            request("/api/calendar/snapshots/restore?id=s1", "POST"),
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            data: { archived: 3, restored: 5 },
        });
        expect(DbCalendarSnapshot.restore).toHaveBeenCalledWith(
            "s1",
            CONTROLLER,
            "2026-a",
        );
        expect(requireStaffSession).toHaveBeenCalled();
    });

    it("rejects a restore with no snapshot id, before touching the iteration", async () => {
        const response = await RestoreRoute.POST(
            request("/api/calendar/snapshots/restore", "POST"),
        );

        expect(response.status).toBe(400);
        expect(resolveWritableIterationFromRequest).not.toHaveBeenCalled();
        expect(DbCalendarSnapshot.restore).not.toHaveBeenCalled();
    });
});
