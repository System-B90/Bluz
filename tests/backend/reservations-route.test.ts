import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CONTROLLER = { tag: "controller" };

vi.mock("@/api-server/db-reservations", () => ({
    DbReservations: { get: vi.fn(), create: vi.fn(), cancel: vi.fn() },
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
    getSessionUser: vi.fn(async () => ({ id: "u1" })),
}));

import { DbReservations } from "@/api-server/db-reservations";
import { resolveWritableIterationFromRequest } from "@/api-server/iteration-request";
import * as ReservationsRoute from "@/app/api/reservations/route";

function request(method: string, query = "", body?: string) {
    return new NextRequest(`http://localhost/api/reservations${query}`, {
        method,
        body,
    });
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/reservations", () => {
    it("passes every filter through, with the room source as a number", async () => {
        vi.mocked(DbReservations.get).mockResolvedValueOnce([] as never);

        await ReservationsRoute.GET(
            request(
                "GET",
                "?roomId=r1&roomSource=1&from=2026-03-01&to=2026-03-08",
            ),
            undefined as never,
        );

        expect(DbReservations.get).toHaveBeenCalledWith(
            "r1",
            1,
            "2026-03-01",
            "2026-03-08",
            CONTROLLER,
        );
    });

    it("coerces a numeric Hive room id back to the number PUT stored", async () => {
        vi.mocked(DbReservations.get).mockResolvedValueOnce([] as never);

        await ReservationsRoute.GET(
            request("GET", "?roomId=123&roomSource=1"),
            undefined as never,
        );

        expect(DbReservations.get).toHaveBeenCalledWith(
            123,
            1,
            undefined,
            undefined,
            CONTROLLER,
        );
    });

    it("keeps a custom room id as a string even when it looks numeric", async () => {
        vi.mocked(DbReservations.get).mockResolvedValueOnce([] as never);

        await ReservationsRoute.GET(
            request("GET", "?roomId=123&roomSource=0"),
            undefined as never,
        );

        expect(DbReservations.get).toHaveBeenCalledWith(
            "123",
            0,
            undefined,
            undefined,
            CONTROLLER,
        );
    });

    it("rejects an unknown room source instead of filtering on NaN", async () => {
        const response = await ReservationsRoute.GET(
            request("GET", "?roomSource=abc"),
            undefined as never,
        );

        expect(response.status).toBe(400);
        expect(DbReservations.get).not.toHaveBeenCalled();
    });

    it("leaves every absent filter undefined rather than null or NaN", async () => {
        vi.mocked(DbReservations.get).mockResolvedValueOnce([] as never);

        await ReservationsRoute.GET(request("GET"), undefined as never);

        expect(DbReservations.get).toHaveBeenCalledWith(
            undefined,
            undefined,
            undefined,
            undefined,
            CONTROLLER,
        );
    });

    it("does not take a write handle for a read", async () => {
        vi.mocked(DbReservations.get).mockResolvedValueOnce([] as never);

        await ReservationsRoute.GET(request("GET"), undefined as never);

        expect(resolveWritableIterationFromRequest).not.toHaveBeenCalled();
    });
});

describe("PUT /api/reservations", () => {
    const payload = {
        roomId: "r1",
        start: "2026-03-01T08:00:00.000Z",
        end: "2026-03-01T10:00:00.000Z",
    };

    it("creates the reservation", async () => {
        vi.mocked(DbReservations.create).mockResolvedValueOnce({
            id: "res1",
        } as never);

        const response = await ReservationsRoute.PUT(
            request("PUT", "", JSON.stringify(payload)),
            undefined as never,
        );

        expect(response.status).toBe(200);
        expect(DbReservations.create).toHaveBeenCalledWith(
            payload,
            CONTROLLER,
        );
    });

    it("rejects a payload missing any of roomId/start/end", async () => {
        for (const key of [ "roomId", "start", "end" ]) {
            const partial = { ...payload, [ key ]: undefined };
            const response = await ReservationsRoute.PUT(
                request("PUT", "", JSON.stringify(partial)),
                undefined as never,
            );

            expect(response.status).toBe(400);
        }
        expect(DbReservations.create).not.toHaveBeenCalled();
    });

    it("rejects an empty body", async () => {
        const response = await ReservationsRoute.PUT(
            request("PUT"),
            undefined as never,
        );

        expect(response.status).toBe(400);
        expect(DbReservations.create).not.toHaveBeenCalled();
    });
});

describe("DELETE /api/reservations", () => {
    it("cancels the reservation named by the bare JSON string body", async () => {
        vi.mocked(DbReservations.cancel).mockResolvedValueOnce(
            undefined as never,
        );

        const response = await ReservationsRoute.DELETE(
            request("DELETE", "", JSON.stringify("res1")),
            undefined as never,
        );

        expect(response.status).toBe(200);
        expect(DbReservations.cancel).toHaveBeenCalledWith("res1", CONTROLLER);
    });

    it("answers 400 — not 500 — for a malformed body", async () => {
        const response = await ReservationsRoute.DELETE(
            request("DELETE", "", "{not json"),
            undefined as never,
        );

        expect(response.status).toBe(400);
        expect(DbReservations.cancel).not.toHaveBeenCalled();
    });

    it("rejects an empty body", async () => {
        const response = await ReservationsRoute.DELETE(
            request("DELETE"),
            undefined as never,
        );

        expect(response.status).toBe(400);
        expect(DbReservations.cancel).not.toHaveBeenCalled();
    });
});
