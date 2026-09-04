import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    apiCancelReservation,
    apiCreateReservation,
    apiGetReservations,
} from "@/api-client/reservations";
import { RoomSource } from "@/api-shared/types/room";

function okJson(data: unknown) {
    return {
        ok: true,
        status: 200,
        redirected: false,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ status: 0, data }),
    } as unknown as Response;
}

function lastCall() {
    const [ url, init ] = vi.mocked(global.fetch).mock.calls.at(-1)!;
    return { url: String(url), init };
}

const rawReservation = {
    id: "res1",
    roomId: "r1",
    start: "2026-03-01T08:00:00.000Z",
    end: "2026-03-01T10:00:00.000Z",
};

describe("reservations api-client", () => {
    const originalFetch = global.fetch;
    beforeEach(() => {
        global.fetch = vi.fn();
    });
    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("asks for everything when no filter is given", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(okJson([]));

        await apiGetReservations();

        expect(lastCall().url).toBe("/api/reservations");
    });

    it("serialises every filter it was given", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(okJson([]));

        await apiGetReservations({
            roomId: "r1",
            roomSource: RoomSource.Custom,
            from: "2026-03-01",
            to: "2026-03-08",
        });

        const params = new URLSearchParams(lastCall().url.split("?")[ 1 ]);
        expect(params.get("roomId")).toBe("r1");
        expect(params.get("roomSource")).toBe(String(RoomSource.Custom));
        expect(params.get("from")).toBe("2026-03-01");
        expect(params.get("to")).toBe("2026-03-08");
    });

    it("keeps a zero room source rather than dropping it as falsy", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(okJson([]));

        await apiGetReservations({ roomSource: 0 as RoomSource });

        expect(lastCall().url).toContain("roomSource=0");
    });

    it("converts the returned timestamps out of their wire form", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(
            okJson([ rawReservation ]),
        );

        const [ reservation ] = await apiGetReservations();

        expect(reservation.id).toBe("res1");
        expect(typeof reservation.start).not.toBe("string");
    });

    it("PUTs a new reservation and converts the response", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(okJson(rawReservation));

        const created = await apiCreateReservation(
            rawReservation as never,
        );

        const { url, init } = lastCall();
        expect(url).toBe("/api/reservations");
        expect(init?.method).toBe("PUT");
        expect(JSON.parse(String(init?.body))).toEqual(rawReservation);
        expect(created.id).toBe("res1");
    });

    it("cancels by sending the bare id as the DELETE body", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(okJson(null));

        await apiCancelReservation("res1" as never);

        const { url, init } = lastCall();
        expect(url).toBe("/api/reservations");
        expect(init?.method).toBe("DELETE");
        expect(init?.body).toBe(JSON.stringify("res1"));
    });

    it("propagates a server failure", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: false,
            status: 409,
            statusText: "Conflict",
            redirected: false,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => ({ status: 1, error: { message: "תפוס" } }),
        } as unknown as Response);

        await expect(
            apiCreateReservation(rawReservation as never),
        ).rejects.toThrow();
    });
});
