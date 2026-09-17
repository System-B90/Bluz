import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api-server/gantt/db-module-event", () => ({
    DbModuleEvent: { applyShuffleGroup: vi.fn() },
}));
vi.mock("@/api-server/session-user", () => ({
    requireStaffSession: vi.fn(async () => undefined),
    getSessionUser: vi.fn(async () => ({ id: "u1" })),
}));

import { DbModuleEvent } from "@/api-server/gantt/db-module-event";
import * as ShuffleGroupRoute from "@/app/api/gantt/events/[id]/shuffle-group/route";

const RESULT = { members: [], removedIds: [] };

function request(body?: unknown) {
    return new NextRequest("http://localhost/api/gantt/events/e1/shuffle-group", {
        method: "POST",
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

const context = (id: string | undefined = "e1") => ({
    params: Promise.resolve({ id: id as string }),
});

beforeEach(() => vi.clearAllMocks());

describe("POST /api/gantt/events/[id]/shuffle-group", () => {
    it("hands the requested shuffles to the group reconciliation", async () => {
        vi.mocked(DbModuleEvent.applyShuffleGroup).mockResolvedValueOnce(
            RESULT as never,
        );

        await ShuffleGroupRoute.POST(
            request({ moduleId: "m1", shuffles: [ "ניצה", "לחם" ] }),
            context(),
        );

        expect(DbModuleEvent.applyShuffleGroup).toHaveBeenCalledWith(
            "e1",
            "m1",
            [ "ניצה", "לחם" ],
        );
    });

    it("passes an empty list through, which ungroups the event", async () => {
        vi.mocked(DbModuleEvent.applyShuffleGroup).mockResolvedValueOnce(
            RESULT as never,
        );

        await ShuffleGroupRoute.POST(
            request({ moduleId: "m1", shuffles: [] }),
            context(),
        );

        expect(DbModuleEvent.applyShuffleGroup).toHaveBeenCalledWith("e1", "m1", []);
    });

    it("rejects a payload with no module to attach new siblings to", async () => {
        const response = await ShuffleGroupRoute.POST(
            request({ shuffles: [ "ניצה" ] }),
            context(),
        );

        expect(response.status).toBe(400);
        expect(DbModuleEvent.applyShuffleGroup).not.toHaveBeenCalled();
    });

    it("rejects shuffles that are not an array", async () => {
        const response = await ShuffleGroupRoute.POST(
            request({ moduleId: "m1", shuffles: "ניצה" }),
            context(),
        );

        expect(response.status).toBe(400);
        expect(DbModuleEvent.applyShuffleGroup).not.toHaveBeenCalled();
    });

    it("rejects an empty body", async () => {
        const response = await ShuffleGroupRoute.POST(request(), context());

        expect(response.status).toBe(400);
        expect(DbModuleEvent.applyShuffleGroup).not.toHaveBeenCalled();
    });
});
