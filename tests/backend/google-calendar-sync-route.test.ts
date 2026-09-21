import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api-server/db-personal-settings", () => ({
    DbPersonalSettings: { get: vi.fn(), set: vi.fn() },
}));
vi.mock("@/api-server/db-event", () => ({
    DbEvent: { getInRange: vi.fn(async () => []) },
}));
vi.mock("@/api-server/google/google-calendar-service", () => ({
    isGoogleCalendarConfigured: vi.fn(() => true),
    getGoogleCalendarSelection: vi.fn(async () => null),
    pullEventEdits: vi.fn(async () => 0),
    pushAllEvents: vi.fn(async () => 0),
    pullBusyBlocks: vi.fn(async () => []),
}));
vi.mock("@/api-server/mongo-db-controller", () => ({
    resolveIterationDb: vi.fn(async (id?: string) => ({
        dbName: id ? `db-${id}` : "db-current",
    })),
    getDatabaseController: vi.fn((dbName: string) => ({ dbName })),
}));
vi.mock("@/api-server/session-user", () => ({
    requireStaffSession: vi.fn(async () => ({ id: "42" })),
}));

import { DbEvent } from "@/api-server/db-event";
import { DbPersonalSettings } from "@/api-server/db-personal-settings";
import {
    getGoogleCalendarSelection,
    isGoogleCalendarConfigured,
    pullBusyBlocks,
    pullEventEdits,
    pushAllEvents,
} from "@/api-server/google/google-calendar-service";
import { resolveIterationDb } from "@/api-server/mongo-db-controller";
import { requireStaffSession } from "@/api-server/session-user";
import { ForbiddenError } from "@/api-shared/errors";
import * as SyncRoute from "@/app/api/integrations/google-calendar/sync/route";

const anyRequest = new Request(
    "http://localhost/api/integrations/google-calendar/sync",
    { method: "POST" },
);

const selection = {
    id: "cal-1",
    summary: "צוות",
    iterationId: "2025b",
    linkedUsers: 1,
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStaffSession).mockResolvedValue({ id: "42" } as never);
    vi.mocked(isGoogleCalendarConfigured).mockReturnValue(true);
    vi.mocked(getGoogleCalendarSelection).mockResolvedValue(selection);
    vi.mocked(DbPersonalSettings.get).mockResolvedValue({
        googleCalendarEnabled: true,
        googleCalendarSyncAllEvents: false,
    } as never);
    vi.mocked(DbEvent.getInRange).mockResolvedValue([ { id: "e1" }, { id: "e2" } ] as never);
    vi.mocked(pushAllEvents).mockResolvedValue(2);
    vi.mocked(pullEventEdits).mockResolvedValue(1);
    vi.mocked(pullBusyBlocks).mockResolvedValue([ { start: "a", end: "b" } ]);
});

describe("POST /api/integrations/google-calendar/sync", () => {
    it("reads the user's own events from the calendar's bound iteration and tags the pushes with it", async () => {
        const response = await SyncRoute.POST(anyRequest, undefined as never);

        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({
            pushed: 2,
            pulled: 1,
            updated: 1,
        });
        expect(resolveIterationDb).toHaveBeenCalledWith("2025b");
        const [ , , , filter, controller ] = vi.mocked(DbEvent.getInRange).mock.calls[0];
        expect(filter).toEqual({
            $or: [ { instructors: 42 }, { lecturers: 42 } ],
        });
        expect(controller).toEqual({ dbName: "db-2025b" });
        expect(pushAllEvents).toHaveBeenCalledWith(
            "42",
            [ { id: "e1" }, { id: "e2" } ],
            "2025b",
        );
    });

    it("pulls Google-side edits before pushing, so a fresh Google edit is not overwritten", async () => {
        const order: Array<string> = [];
        vi.mocked(pullEventEdits).mockImplementation(async () => {
            order.push("pull");
            return 0;
        });
        vi.mocked(pushAllEvents).mockImplementation(async () => {
            order.push("push");
            return 0;
        });

        await SyncRoute.POST(anyRequest, undefined as never);

        expect(order).toEqual([ "pull", "push" ]);
    });

    it("drops the assignment filter for a sync-all user", async () => {
        vi.mocked(DbPersonalSettings.get).mockResolvedValue({
            googleCalendarEnabled: true,
            googleCalendarSyncAllEvents: true,
        } as never);

        await SyncRoute.POST(anyRequest, undefined as never);

        expect(vi.mocked(DbEvent.getInRange).mock.calls[0][3]).toBeUndefined();
    });

    it("falls back to the current iteration for a legacy link with none bound", async () => {
        vi.mocked(getGoogleCalendarSelection).mockResolvedValue({
            ...selection,
            iterationId: undefined,
        });

        await SyncRoute.POST(anyRequest, undefined as never);

        expect(resolveIterationDb).toHaveBeenCalledWith(undefined);
        expect(pushAllEvents).toHaveBeenCalledWith("42", expect.anything(), undefined);
    });

    it("400s when not connected, touching nothing", async () => {
        vi.mocked(getGoogleCalendarSelection).mockResolvedValue(null);

        const response = await SyncRoute.POST(anyRequest, undefined as never);

        expect(response.status).toBe(400);
        expect(pullEventEdits).not.toHaveBeenCalled();
        expect(pushAllEvents).not.toHaveBeenCalled();
    });

    it("400s when the deployment has no Google client", async () => {
        vi.mocked(isGoogleCalendarConfigured).mockReturnValue(false);

        const response = await SyncRoute.POST(anyRequest, undefined as never);

        expect(response.status).toBe(400);
        expect(getGoogleCalendarSelection).not.toHaveBeenCalled();
    });

    it("403s a caller without staff clearance", async () => {
        vi.mocked(requireStaffSession).mockRejectedValueOnce(
            new ForbiddenError("Forbidden: insufficient clearance."),
        );

        const response = await SyncRoute.POST(anyRequest, undefined as never);

        expect(response.status).toBe(403);
        expect(pushAllEvents).not.toHaveBeenCalled();
    });
});
