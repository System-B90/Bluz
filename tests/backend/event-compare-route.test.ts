import { NextRequest } from "next/server";
import { beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("@/api-server/db-event", () => ({
    DbEvent: { getInRange: vi.fn() },
}));

vi.mock("@/api-server/mongo-db-controller", () => ({
    resolveIterationDb: vi.fn(async (id?: string) => ({
        dbName: id ? `db_${id}` : "current",
    })),
}));

import { DbEvent, DbEventDocument } from "@/api-server/db-event";
import { resolveIterationDb } from "@/api-server/mongo-db-controller";
import * as CompareRoute from "@/app/api/event/compare/route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/event/compare", () => {
    it("returns events for both iterations over the same range", async () => {
        vi.mocked(DbEvent.getInRange)
            .mockResolvedValueOnce([{ id: "a1" }] as Array<Partial<DbEventDocument>> as Array<DbEventDocument>)
            .mockResolvedValueOnce([{ id: "b1" }] as Array<Partial<DbEventDocument>> as Array<DbEventDocument>);

        const req = new NextRequest(
            "http://localhost/api/event/compare?sd=2026-01-01T00:00:00.000Z&ed=2026-01-10T00:00:00.000Z&itA=2026a&itB=2026b",
        );
        const res = await CompareRoute.GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.a).toEqual([{ id: "a1" }]);
        expect(body.data.b).toEqual([{ id: "b1" }]);
        expect(resolveIterationDb).toHaveBeenCalledWith("2026a");
        expect(resolveIterationDb).toHaveBeenCalledWith("2026b");
    });

    it("rejects a request without a date range", async () => {
        const req = new NextRequest(
            "http://localhost/api/event/compare?itA=2026a&itB=2026b",
        );
        const res = await CompareRoute.GET(req);
        expect(res.status).toBe(400);
        expect(DbEvent.getInRange).not.toHaveBeenCalled();
    });

    it("rejects an invalid date", async () => {
        const req = new NextRequest(
            "http://localhost/api/event/compare?sd=notadate&ed=alsobad",
        );
        const res = await CompareRoute.GET(req);
        expect(res.status).toBe(400);
    });
});
