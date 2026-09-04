import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CONTROLLER = { tag: "controller" };

vi.mock("@/api-server/db-calendar-draft", () => ({
    DbCalendarDraft: {
        list: vi.fn(),
        get: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        del: vi.fn(),
    },
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
    getSessionUser: vi.fn(async () => ({ id: "u1", displayName: "רכזת" })),
}));

import { DbCalendarDraft } from "@/api-server/db-calendar-draft";
import {
    resolveIterationFromRequest,
    resolveWritableIterationFromRequest,
} from "@/api-server/iteration-request";
import { getSessionUser, requireStaffSession } from "@/api-server/session-user";
import * as DraftsRoute from "@/app/api/calendar/drafts/route";

function request(method: string, query = "", body?: unknown) {
    return new NextRequest(`http://localhost/api/calendar/drafts${query}`, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/calendar/drafts", () => {
    it("lists the iteration's drafts when no id is given", async () => {
        vi.mocked(DbCalendarDraft.list).mockResolvedValueOnce([
            { id: "d1" },
        ] as never);

        const response = await DraftsRoute.GET(request("GET"));

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ data: [ { id: "d1" } ] });
        expect(DbCalendarDraft.list).toHaveBeenCalledWith(
            CONTROLLER,
            "2026-a",
        );
        expect(DbCalendarDraft.get).not.toHaveBeenCalled();
    });

    it("fetches one draft when ?id= is given", async () => {
        vi.mocked(DbCalendarDraft.get).mockResolvedValueOnce({
            id: "d1",
            events: [],
        } as never);

        await DraftsRoute.GET(request("GET", "?id=d1"));

        expect(DbCalendarDraft.get).toHaveBeenCalledWith("d1", CONTROLLER);
    });

    it("reads through the read-only iteration resolver", async () => {
        vi.mocked(DbCalendarDraft.list).mockResolvedValueOnce([] as never);

        await DraftsRoute.GET(request("GET"));

        expect(resolveIterationFromRequest).toHaveBeenCalled();
        expect(resolveWritableIterationFromRequest).not.toHaveBeenCalled();
        expect(requireStaffSession).toHaveBeenCalled();
    });
});

describe("POST /api/calendar/drafts", () => {
    it("creates the draft with the session user as author", async () => {
        vi.mocked(DbCalendarDraft.create).mockResolvedValueOnce({
            id: "d1",
        } as never);

        const response = await DraftsRoute.POST(
            request("POST", "", {
                label: "טיוטה",
                events: [ { id: "e1", startTime: "2026-03-01T08:00:00.000Z" } ],
            }),
        );

        expect(response.status).toBe(200);
        const [ label, events, author, controller, iterationId ] =
            vi.mocked(DbCalendarDraft.create).mock.calls[ 0 ];
        expect(label).toBe("טיוטה");
        expect((events[ 0 ] as { startTime: Date }).startTime).toBeInstanceOf(
            Date,
        );
        expect(author).toEqual({ id: "u1", displayName: "רכזת" });
        expect(controller).toBe(CONTROLLER);
        expect(iterationId).toBe("2026-a");
    });

    it("falls back to a placeholder author name for a nameless session", async () => {
        vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "u1" } as never);
        vi.mocked(DbCalendarDraft.create).mockResolvedValueOnce({} as never);

        await DraftsRoute.POST(request("POST", "", { label: "x" }));

        expect(
            vi.mocked(DbCalendarDraft.create).mock.calls[ 0 ][ 2 ],
        ).toEqual({ id: "u1", displayName: "משתמש" });
    });

    it("treats a missing events list as an empty capture", async () => {
        vi.mocked(DbCalendarDraft.create).mockResolvedValueOnce({} as never);

        await DraftsRoute.POST(request("POST", "", { label: "x" }));

        expect(vi.mocked(DbCalendarDraft.create).mock.calls[ 0 ][ 1 ]).toEqual(
            [],
        );
    });

    it("rejects a body with no label", async () => {
        const response = await DraftsRoute.POST(
            request("POST", "", { events: [] }),
        );

        expect(response.status).toBe(400);
        expect(DbCalendarDraft.create).not.toHaveBeenCalled();
    });

    it("rejects a missing body", async () => {
        const response = await DraftsRoute.POST(request("POST"));

        expect(response.status).toBe(400);
        expect(DbCalendarDraft.create).not.toHaveBeenCalled();
    });

    it("writes through the writable iteration resolver", async () => {
        vi.mocked(DbCalendarDraft.create).mockResolvedValueOnce({} as never);

        await DraftsRoute.POST(request("POST", "", { label: "x" }));

        expect(resolveWritableIterationFromRequest).toHaveBeenCalled();
    });
});

describe("PUT /api/calendar/drafts", () => {
    it("updates the draft's events", async () => {
        vi.mocked(DbCalendarDraft.update).mockResolvedValueOnce({} as never);

        await DraftsRoute.PUT(
            request("PUT", "", { id: "d1", events: [], label: "שם" }),
        );

        const [ id, events, , , label ] = vi.mocked(DbCalendarDraft.update).mock
            .calls[ 0 ];
        expect(id).toBe("d1");
        expect(events).toEqual([]);
        expect(label).toBe("שם");
    });

    it("distinguishes an absent events list from an empty one (#512)", async () => {
        vi.mocked(DbCalendarDraft.update).mockResolvedValueOnce({} as never);

        await DraftsRoute.PUT(request("PUT", "", { id: "d1" }));

        expect(
            vi.mocked(DbCalendarDraft.update).mock.calls[ 0 ][ 1 ],
        ).toBeUndefined();
    });

    it("rejects a non-array events value", async () => {
        const response = await DraftsRoute.PUT(
            request("PUT", "", { id: "d1", events: "nope" }),
        );

        expect(response.status).toBe(400);
        expect(DbCalendarDraft.update).not.toHaveBeenCalled();
    });

    it("rejects a missing id and a non-string label", async () => {
        expect(
            (await DraftsRoute.PUT(request("PUT", "", { events: [] }))).status,
        ).toBe(400);
        expect(
            (
                await DraftsRoute.PUT(
                    request("PUT", "", { id: "d1", label: 7 }),
                )
            ).status,
        ).toBe(400);
        expect(DbCalendarDraft.update).not.toHaveBeenCalled();
    });
});

describe("DELETE /api/calendar/drafts", () => {
    it("deletes the draft named by ?id=", async () => {
        vi.mocked(DbCalendarDraft.del).mockResolvedValueOnce(
            undefined as never,
        );

        const response = await DraftsRoute.DELETE(
            request("DELETE", "?id=d1"),
        );

        expect(response.status).toBe(200);
        expect(DbCalendarDraft.del).toHaveBeenCalledWith("d1", CONTROLLER);
    });

    it("rejects a delete with no id", async () => {
        const response = await DraftsRoute.DELETE(request("DELETE"));

        expect(response.status).toBe(400);
        expect(DbCalendarDraft.del).not.toHaveBeenCalled();
    });
});
