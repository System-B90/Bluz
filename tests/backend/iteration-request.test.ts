import { NextRequest } from "next/server";
import { beforeEach, describe, it, expect, vi } from "vitest";

const { resolveIterationDb, assertWritable } = vi.hoisted(() => ({
    resolveIterationDb: vi.fn(async (id?: string) => ({
        dbName: id ? `db_${id}` : "current",
    })),
    assertWritable: vi.fn(async () => undefined),
}));

vi.mock("@/api-server/mongo-db-controller", () => ({ resolveIterationDb }));
vi.mock("@/api-server/db-iterations", () => ({
    DbIterations: { assertWritable },
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
            await resolveIterationFromRequest(req as any);
        expect(iterationId).toBeUndefined();
        expect((controller as any).dbName).toBe("current");
        expect(resolveIterationDb).toHaveBeenCalledWith(undefined);
    });

    it("reads the iteration id from the query string", async () => {
        const req = new NextRequest(
            `http://localhost/api/event?${ITERATION_QUERY_PARAM}=2026b`,
        );
        const { iterationId, controller } =
            await resolveIterationFromRequest(req as any);
        expect(iterationId).toBe("2026b");
        expect((controller as any).dbName).toBe("db_2026b");
    });

    it("treats an empty `it` param as the current iteration", async () => {
        const req = new NextRequest(`http://localhost/api/event?it=`);
        const { iterationId } = await resolveIterationFromRequest(req as any);
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
    it("passes the iteration through the write guard", async () => {
        const req = new NextRequest("http://localhost/api/event?it=past");
        await resolveWritableIterationFromRequest(req as any);
        expect(assertWritable).toHaveBeenCalledWith("past");
    });

    it("propagates a guard rejection", async () => {
        assertWritable.mockRejectedValueOnce(new Error("read only"));
        const req = new NextRequest("http://localhost/api/event?it=past");
        await expect(
            resolveWritableIterationFromRequest(req as any),
        ).rejects.toThrow("read only");
    });
});
