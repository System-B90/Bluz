import { beforeEach, describe, expect, it, vi } from "vitest";

const CONTROLLER = { tag: "controller" };

vi.mock("@/api-server/db-event", () => ({
    DbEvent: { getInRange: vi.fn(async () => []) },
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

import { DbEvent } from "@/api-server/db-event";
import * as IcsRoute from "@/app/api/event/export/ics/route";
import { MAX_EVENT_RANGE_DAYS } from "@/settings";

const request = (query: string) =>
    new Request(`http://localhost/api/event/export/ics${query}`);

const iso = (date: string) => new Date(date).toISOString();

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(DbEvent.getInRange).mockResolvedValue([] as never);
});

describe("GET /api/event/export/ics", () => {
    it("serves a downloadable, uncached ICS calendar for the range", async () => {
        const response = await IcsRoute.GET(
            request(`?sd=${iso("2026-03-01")}&ed=${iso("2026-03-08")}`),
            undefined as never,
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/calendar");
        expect(response.headers.get("content-disposition")).toContain(
            "attachment",
        );
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect(await response.text()).toContain("BEGIN:VCALENDAR");
    });

    it("reads the range from the resolved iteration's controller", async () => {
        await IcsRoute.GET(
            request(`?sd=${iso("2026-03-01")}&ed=${iso("2026-03-08")}`),
            undefined as never,
        );

        const [ start, end, , , controller ] = vi.mocked(DbEvent.getInRange).mock
            .calls[ 0 ];
        expect(start).toEqual(new Date(iso("2026-03-01")));
        expect(end).toEqual(new Date(iso("2026-03-08")));
        expect(controller).toBe(CONTROLLER);
    });

    it("rejects a request missing either bound", async () => {
        for (const query of [ "", `?sd=${iso("2026-03-01")}`, `?ed=${iso("2026-03-08")}` ]) {
            expect(
                (await IcsRoute.GET(request(query), undefined as never)).status,
            ).toBe(400);
        }
        expect(DbEvent.getInRange).not.toHaveBeenCalled();
    });

    it("rejects unparsable dates", async () => {
        const response = await IcsRoute.GET(
            request("?sd=yesterday&ed=tomorrow"),
            undefined as never,
        );

        expect(response.status).toBe(400);
        expect(DbEvent.getInRange).not.toHaveBeenCalled();
    });

    it("rejects an inverted range and one longer than the cap", async () => {
        const inverted = await IcsRoute.GET(
            request(`?sd=${iso("2026-03-08")}&ed=${iso("2026-03-01")}`),
            undefined as never,
        );
        expect(inverted.status).toBe(400);

        const tooLong = new Date(
            Date.UTC(2026, 2, 1) +
                (MAX_EVENT_RANGE_DAYS + 1) * 24 * 60 * 60 * 1000,
        ).toISOString();
        const wide = await IcsRoute.GET(
            request(`?sd=${iso("2026-03-01")}&ed=${tooLong}`),
            undefined as never,
        );
        expect(wide.status).toBe(400);

        expect(DbEvent.getInRange).not.toHaveBeenCalled();
    });

    it("accepts a zero-length range", async () => {
        const response = await IcsRoute.GET(
            request(`?sd=${iso("2026-03-01")}&ed=${iso("2026-03-01")}`),
            undefined as never,
        );

        expect(response.status).toBe(200);
    });
});
