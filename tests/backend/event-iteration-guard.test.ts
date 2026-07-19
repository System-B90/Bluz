import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the calendar DB ops so we can assert wiring without Mongo.
vi.mock("@/api-server/db-event", () => ({
    DbEvent: {
        get: vi.fn(),
        getMultiple: vi.fn(),
        getInRange: vi.fn(),
        set: vi.fn(),
        create: vi.fn(),
        del: vi.fn(),
    },
}));

// Resolve any iteration to a stub controller, no Mongo needed. The writable
// resolver enforces the read-only guard: reject the "past" iteration only.
const { fakeController, resolveIterationDb, resolveWritableIterationDb } =
    vi.hoisted(() => {
        const fakeController = { dbName: "stub" };
        return {
            fakeController,
            resolveIterationDb: vi.fn(async () => fakeController),
            resolveWritableIterationDb: vi.fn(async (id?: string) => {
                if (id === "past") {
                    const { ClientApiError } = await import(
                        "@/api-shared/errors"
                    );
                    throw new ClientApiError("read only");
                }
                return fakeController;
            }),
        };
    });

vi.mock("@/api-server/mongo-db-controller", () => ({
    resolveIterationDb,
    resolveWritableIterationDb,
}));

import { DbEvent, DbEventDocument } from "@/api-server/db-event";
import * as EventRoute from "@/app/api/event/route";

beforeEach(() => vi.clearAllMocks());

describe("event route — iteration read-only guard", () => {
    it("rejects a write to a past iteration and never touches the DB", async () => {
        const req = new NextRequest(
            "http://localhost/api/event?it=past",
            {
                method: "POST",
                body: JSON.stringify({ id: "e1", title: "x" }),
            },
        );
        const res = await EventRoute.POST(req);

        expect(res.status).toBe(400);
        expect(resolveWritableIterationDb).toHaveBeenCalledWith("past");
        expect(DbEvent.set).not.toHaveBeenCalled();
    });

    it("allows a write to the current run and stamps no iterationId", async () => {
        vi.mocked(DbEvent.set).mockResolvedValueOnce({
            id: "e1",
        } as Partial<DbEventDocument> as DbEventDocument);
        const req = new NextRequest("http://localhost/api/event", {
            method: "POST",
            body: JSON.stringify({ id: "e1", title: "x" }),
        });
        const res = await EventRoute.POST(req);

        expect(res.status).toBe(200);
        // 4th arg (iterationId) is undefined for the current run.
        expect(DbEvent.set).toHaveBeenCalledWith(
            expect.anything(),
            undefined,
            fakeController,
            undefined,
        );
    });

    it("scopes a range read to the requested iteration", async () => {
        vi.mocked(DbEvent.getInRange).mockResolvedValueOnce([]);
        const req = new NextRequest(
            "http://localhost/api/event?sd=2026-01-01T00:00:00.000Z&ed=2026-01-10T00:00:00.000Z&it=2026b",
        );
        const res = await EventRoute.GET(req);

        expect(res.status).toBe(200);
        expect(resolveIterationDb).toHaveBeenCalledWith("2026b");
        expect(resolveWritableIterationDb).not.toHaveBeenCalled();
        expect(DbEvent.getInRange).toHaveBeenCalledWith(
            expect.any(Date),
            expect.any(Date),
            undefined,
            undefined,
            fakeController,
        );
    });
});
