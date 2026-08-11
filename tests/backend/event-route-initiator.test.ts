import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-level wiring for the change log: the event API must translate the
 * client's declared-action header into the write origin passed down to
 * `DbEvent`, and must never let an unknown value through as-is.
 */

vi.mock("@/api-server/db-event", () => ({
    DbEvent: {
        create: vi.fn(),
        del: vi.fn(),
        get: vi.fn(),
        getInRange: vi.fn(),
        getMultiple: vi.fn(),
        set: vi.fn(),
    },
}));

const { fakeController, getMetaController, resolveIterationDb, resolveWritableIterationDb } =
    vi.hoisted(() => {
        const controller = { dbName: "stub" };
        return {
            fakeController: controller,
            getMetaController: vi.fn(() => ({
                personalSettings: {
                    find: vi.fn(() => ({ toArray: async () => [] })),
                },
            })),
            resolveIterationDb: vi.fn(async () => controller),
            resolveWritableIterationDb: vi.fn(async () => controller),
        };
    });

vi.mock("@/api-server/mongo-db-controller", () => ({
    getMetaController,
    resolveIterationDb,
    resolveWritableIterationDb,
}));

import { DbEvent } from "@/api-server/db-event";
import {
    EVENT_INITIATOR_HEADER,
    EventChangeInitiator,
} from "@/api-shared/types/event-history";
import * as EventRoute from "@/app/api/event/route";

function request(
    method: "DELETE" | "POST" | "PUT",
    body: unknown,
    initiator?: string,
): NextRequest {
    return new NextRequest("http://localhost/api/event", {
        body: JSON.stringify(body),
        headers: initiator ? { [EVENT_INITIATOR_HEADER]: initiator } : undefined,
        method,
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(DbEvent.get).mockResolvedValue(null);
});

describe("event route — declared initiator", () => {
    it("passes a drag-and-drop update through as the write origin", async () => {
        await EventRoute.POST(
            request("POST", { id: "e1" }, EventChangeInitiator.DragDrop),
        );

        expect(DbEvent.set).toHaveBeenCalledWith(
            expect.anything(),
            undefined,
            fakeController,
            undefined,
            { initiator: EventChangeInitiator.DragDrop },
        );
    });

    it("passes a copy/paste creation through as the write origin", async () => {
        await EventRoute.PUT(
            request("PUT", { id: "e1" }, EventChangeInitiator.CopyPaste),
        );

        expect(DbEvent.create).toHaveBeenCalledWith(
            expect.anything(),
            undefined,
            fakeController,
            undefined,
            { initiator: EventChangeInitiator.CopyPaste },
        );
    });

    it("passes a keyboard deletion through as the write origin", async () => {
        await EventRoute.DELETE(
            request("DELETE", "e1", EventChangeInitiator.Keyboard),
        );

        expect(DbEvent.del).toHaveBeenCalledWith(
            "e1",
            undefined,
            fakeController,
            undefined,
            { initiator: EventChangeInitiator.Keyboard },
        );
    });

    it("falls back to Unknown when the header is absent", async () => {
        await EventRoute.POST(request("POST", { id: "e1" }));

        expect(DbEvent.set).toHaveBeenCalledWith(
            expect.anything(),
            undefined,
            fakeController,
            undefined,
            { initiator: EventChangeInitiator.Unknown },
        );
    });

    it("rejects an unrecognized header value instead of storing it", async () => {
        await EventRoute.POST(request("POST", { id: "e1" }, "not-an-action"));

        expect(DbEvent.set).toHaveBeenCalledWith(
            expect.anything(),
            undefined,
            fakeController,
            undefined,
            { initiator: EventChangeInitiator.Unknown },
        );
    });

    it("cannot be used to spoof a gantt-owned initiator's meaning", async () => {
        // A client *may* send "gantt-cut"; the log records exactly what was
        // declared, and the actor is still resolved server-side — so the header
        // can never fabricate an identity, only mislabel an action.
        await EventRoute.POST(
            request("POST", { id: "e1" }, EventChangeInitiator.GanttCut),
        );

        const origin = vi.mocked(DbEvent.set).mock.calls[0][4];
        expect(origin).toEqual({ initiator: EventChangeInitiator.GanttCut });
        expect(origin).not.toHaveProperty("actor");
    });
});
