import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The change-log read endpoint: session-gated, iteration-scoped, and
 * serialized for the wire (dates as ISO strings).
 */

const { fakeController, resolveIterationDb, resolveWritableIterationDb } =
    vi.hoisted(() => {
        const controller = { dbName: "stub" };
        return {
            fakeController: controller,
            resolveIterationDb: vi.fn(async () => controller),
            resolveWritableIterationDb: vi.fn(async () => controller),
        };
    });

vi.mock("@/api-server/mongo-db-controller", () => ({
    getMetaController: vi.fn(),
    resolveIterationDb,
    resolveWritableIterationDb,
}));
vi.mock("@/api-server/db-event-history", () => ({
    DbEventHistory: { forEvent: vi.fn(async () => []) },
}));
// Staff-gated since #656: the log echoes whole event documents, so a Hanich
// session must not reach it even though it holds a valid session.
vi.mock("@/api-server/session-user", () => ({
    requireStaffSession: vi.fn(async () => ({ display_name: "מיכאל", id: "7" })),
}));

import { DbEventHistory } from "@/api-server/db-event-history";
import { requireStaffSession } from "@/api-server/session-user";
import { ForbiddenError } from "@/api-shared/errors";
import {
    EventChangeAction,
    EventChangeInitiator,
} from "@/api-shared/types/event-history";
import * as HistoryRoute from "@/app/api/event/history/route";

const row = {
    action: EventChangeAction.Updated,
    actorHiveId: 7,
    actorId: "7",
    actorName: "מיכאל",
    changedAt: new Date("2024-02-01T10:00:00.000Z"),
    changes: [{ field: "name", from: "א", to: "ב" }],
    eventId: "e1",
    id: "row-1",
    initiator: EventChangeInitiator.EventDialog,
};

function request(url: string): NextRequest {
    return new NextRequest(url, { method: "GET" });
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStaffSession).mockResolvedValue({
        display_name: "מיכאל",
        id: "7",
    } as never);
});

describe("GET /api/event/history", () => {
    it("returns the event's log with ISO timestamps", async () => {
        vi.mocked(DbEventHistory.forEvent).mockResolvedValue([row] as never);

        const response = await HistoryRoute.GET(
            request("http://localhost/api/event/history?id=e1"),
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.data).toEqual([
            { ...row, changedAt: "2024-02-01T10:00:00.000Z" },
        ]);
    });

    it("reads from the iteration named on the request", async () => {
        await HistoryRoute.GET(
            request("http://localhost/api/event/history?id=e1&it=2025b"),
        );

        expect(DbEventHistory.forEvent).toHaveBeenCalledWith(
            "e1",
            fakeController,
        );
        expect(resolveIterationDb).toHaveBeenCalledWith("2025b");
    });

    it("rejects a request with no event id", async () => {
        const response = await HistoryRoute.GET(
            request("http://localhost/api/event/history"),
        );

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(DbEventHistory.forEvent).not.toHaveBeenCalled();
    });

    it("never serves the log to a non-staff caller", async () => {
        vi.mocked(requireStaffSession).mockRejectedValue(
            new ForbiddenError("Forbidden: insufficient clearance."),
        );

        const response = await HistoryRoute.GET(
            request("http://localhost/api/event/history?id=e1"),
        );

        expect(response.status).toBe(403);
        expect(DbEventHistory.forEvent).not.toHaveBeenCalled();
    });
});
