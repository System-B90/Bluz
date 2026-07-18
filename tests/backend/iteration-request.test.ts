import { NextRequest } from "next/server";
import { beforeEach, describe, it, expect, vi } from "vitest";

const { resolveIterationDb, resolveWritableIterationDb } = vi.hoisted(() => ({
    resolveIterationDb: vi.fn(async (id?: string) => ({
        dbName: id ? `db_${id}` : "current",
    })),
    resolveWritableIterationDb: vi.fn(async (id?: string) => ({
        dbName: id ? `db_${id}` : "current",
    })),
}));

vi.mock("@/api-server/mongo-db-controller", () => ({
    resolveIterationDb,
    resolveWritableIterationDb,
}));

import {
    ITERATION_QUERY_PARAM,
    resolveIterationFromRequest,
    resolveWritableIterationFromRequest,
} from "@/api-server/iteration-request";

beforeEach(() => vi.clearAllMocks());

describe("resolveIterationFromRequest", () => {
    it("defaults to the current iteration when no `it` param is present", async () => {
        const req = new NextRequest("http://localhost/api/event");
        const { iterationId, controller } =
            await resolveIterationFromRequest(req);
        expect(iterationId).toBeUndefined();
        expect(controller.dbName).toBe("current");
        expect(resolveIterationDb).toHaveBeenCalledWith(undefined);
    });

    it("reads the iteration id from the query string", async () => {
        const req = new NextRequest(
            `http://localhost/api/event?${ITERATION_QUERY_PARAM}=2026b`,
        );
        const { iterationId, controller } =
            await resolveIterationFromRequest(req);
        expect(iterationId).toBe("2026b");
        expect(controller.dbName).toBe("db_2026b");
    });

    it("treats an empty `it` param as the current iteration", async () => {
        const req = new NextRequest(`http://localhost/api/event?it=`);
        const { iterationId } = await resolveIterationFromRequest(req);
        expect(iterationId).toBeUndefined();
    });

    it("supports a plain { url } object", async () => {
        const { iterationId } = await resolveIterationFromRequest({
            url: "http://localhost/api/event?it=plain",
        });
        expect(iterationId).toBe("plain");
    });
});

describe("resolveWritableIterationFromRequest", () => {
    it("resolves writes through the writable resolver", async () => {
        const req = new NextRequest("http://localhost/api/event?it=past");
        const { iterationId } =
            await resolveWritableIterationFromRequest(req);
        expect(iterationId).toBe("past");
        expect(resolveWritableIterationDb).toHaveBeenCalledWith("past");
    });

    it("propagates a read-only rejection from the resolver", async () => {
        resolveWritableIterationDb.mockRejectedValueOnce(
            new Error("read only"),
        );
        const req = new NextRequest("http://localhost/api/event?it=past");
        await expect(
            resolveWritableIterationFromRequest(req),
        ).rejects.toThrow("read only");
    });
});
