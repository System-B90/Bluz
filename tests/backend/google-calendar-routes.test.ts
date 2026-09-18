import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api-server/db-personal-settings", () => ({
    DbPersonalSettings: { get: vi.fn(), set: vi.fn() },
}));
vi.mock("@/api-server/google/google-calendar-service", () => ({
    isGoogleCalendarConfigured: vi.fn(() => true),
    getGoogleCalendarSelection: vi.fn(async () => null),
    getGoogleClientId: vi.fn(() => "client-id.apps.googleusercontent.com"),
    getGoogleScopes: vi.fn(() => [ "https://www.googleapis.com/auth/calendar" ]),
    disconnectGoogleCalendar: vi.fn(async () => undefined),
    listGoogleCalendarOptions: vi.fn(async () => ({ calendars: [], selectedId: "" })),
    selectGoogleCalendar: vi.fn(async () => ({})),
    purgeGoogleEvents: vi.fn(async () => ({ scanned: 0, removed: 0, failed: 0 })),
}));
vi.mock("@/api-server/session-user", () => ({
    // Staff-gated since #656 — Google Calendar sync is a staff surface.
    requireStaffSession: vi.fn(async () => ({ id: "u1" })),
}));

import { DbPersonalSettings } from "@/api-server/db-personal-settings";
import {
    disconnectGoogleCalendar,
    getGoogleCalendarSelection,
    isGoogleCalendarConfigured,
    listGoogleCalendarOptions,
    purgeGoogleEvents,
    selectGoogleCalendar,
} from "@/api-server/google/google-calendar-service";
import { requireStaffSession } from "@/api-server/session-user";
import { ForbiddenError } from "@/api-shared/errors";
import * as CalendarsRoute from "@/app/api/integrations/google-calendar/calendars/route";
import * as DisconnectRoute from "@/app/api/integrations/google-calendar/disconnect/route";
import * as PurgeRoute from "@/app/api/integrations/google-calendar/purge/route";
import * as StatusRoute from "@/app/api/integrations/google-calendar/status/route";

const anyRequest = new Request(
    "http://localhost/api/integrations/google-calendar/status",
);

const jsonRequest = (path: string, body: unknown) =>
    new Request(`http://localhost/api/integrations/google-calendar/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });

const selection = {
    id: "cal-1",
    summary: "צוות",
    accessRole: "writer" as const,
    iterationId: "2026a",
    iterationLabel: "מחזור 2026 א'",
    linkedUsers: 2,
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStaffSession).mockResolvedValue({ id: "u1" } as never);
    vi.mocked(isGoogleCalendarConfigured).mockReturnValue(true);
    vi.mocked(getGoogleCalendarSelection).mockResolvedValue(selection);
    vi.mocked(DbPersonalSettings.get).mockResolvedValue({
        googleCalendarEnabled: true,
    } as never);
});

describe("GET /api/integrations/google-calendar/status", () => {
    it("reports configuration, connection, the user's toggle, the GIS inputs and the calendar", async () => {
        const response = await StatusRoute.GET(anyRequest, undefined as never);

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect((await response.json()).data).toEqual({
            configured: true,
            connected: true,
            enabled: true,
            clientId: "client-id.apps.googleusercontent.com",
            scopes: [ "https://www.googleapis.com/auth/calendar" ],
            calendar: selection,
        });
        expect(getGoogleCalendarSelection).toHaveBeenCalledWith("u1");
        expect(DbPersonalSettings.get).toHaveBeenCalledWith("u1");
    });

    it("omits the calendar while disconnected", async () => {
        vi.mocked(getGoogleCalendarSelection).mockResolvedValue(null);

        const { data } = await (
            await StatusRoute.GET(anyRequest, undefined as never)
        ).json();

        expect(data.connected).toBe(false);
        expect(data).not.toHaveProperty("calendar");
    });

    it("reports an unconfigured deployment without claiming a connection", async () => {
        vi.mocked(isGoogleCalendarConfigured).mockReturnValue(false);
        vi.mocked(getGoogleCalendarSelection).mockResolvedValue(null);

        const { data } = await (
            await StatusRoute.GET(anyRequest, undefined as never)
        ).json();

        expect(data.configured).toBe(false);
        expect(data.connected).toBe(false);
    });

    it("403s a caller without staff clearance", async () => {
        vi.mocked(requireStaffSession).mockRejectedValueOnce(
            new ForbiddenError("Forbidden: insufficient clearance."),
        );

        const response = await StatusRoute.GET(anyRequest, undefined as never);

        expect(response.status).toBe(403);
        expect(DbPersonalSettings.get).not.toHaveBeenCalled();
    });
});

describe("POST /api/integrations/google-calendar/disconnect", () => {
    it("disconnects the signed-in user's account", async () => {
        const response = await DisconnectRoute.POST(
            anyRequest,
            undefined as never,
        );

        expect(response.status).toBe(200);
        expect(disconnectGoogleCalendar).toHaveBeenCalledWith("u1");
    });

    it("403s a caller without staff clearance, disconnecting nothing", async () => {
        vi.mocked(requireStaffSession).mockRejectedValueOnce(
            new ForbiddenError("Forbidden: insufficient clearance."),
        );

        const response = await DisconnectRoute.POST(
            anyRequest,
            undefined as never,
        );

        expect(response.status).toBe(403);
        expect(disconnectGoogleCalendar).not.toHaveBeenCalled();
    });
});

describe("GET /api/integrations/google-calendar/calendars", () => {
    it("lists the signed-in user's writable calendars, uncached", async () => {
        vi.mocked(listGoogleCalendarOptions).mockResolvedValue({
            calendars: [
                { id: "a", summary: "A", accessRole: "owner", primary: true, shared: false },
            ],
            selectedId: "a",
        });

        const response = await CalendarsRoute.GET(anyRequest, undefined as never);

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect((await response.json()).data.selectedId).toBe("a");
        expect(listGoogleCalendarOptions).toHaveBeenCalledWith("u1");
    });

    it("400s when the deployment has no Google client", async () => {
        vi.mocked(isGoogleCalendarConfigured).mockReturnValue(false);

        const response = await CalendarsRoute.GET(anyRequest, undefined as never);

        expect(response.status).toBe(400);
        expect(listGoogleCalendarOptions).not.toHaveBeenCalled();
    });

    it("403s a caller without staff clearance", async () => {
        vi.mocked(requireStaffSession).mockRejectedValueOnce(
            new ForbiddenError("Forbidden: insufficient clearance."),
        );

        const response = await CalendarsRoute.GET(anyRequest, undefined as never);

        expect(response.status).toBe(403);
        expect(listGoogleCalendarOptions).not.toHaveBeenCalled();
    });
});

describe("POST /api/integrations/google-calendar/calendars", () => {
    it("re-points the link at the given calendar", async () => {
        vi.mocked(selectGoogleCalendar).mockResolvedValue(selection);

        const response = await CalendarsRoute.POST(
            jsonRequest("calendars", { calendarId: "cal-1" }) as never,
            undefined as never,
        );

        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual(selection);
        expect(selectGoogleCalendar).toHaveBeenCalledWith("u1", { calendarId: "cal-1" });
    });

    it("creates a fresh calendar on createNew", async () => {
        await CalendarsRoute.POST(
            jsonRequest("calendars", { createNew: true }) as never,
            undefined as never,
        );

        expect(selectGoogleCalendar).toHaveBeenCalledWith("u1", { createNew: true });
    });

    it.each([
        [ "neither", {} ],
        [ "both", { calendarId: "x", createNew: true } ],
        [ "a non-string id", { calendarId: 5 } ],
        [ "createNew false alone", { createNew: false } ],
    ])("400s on %s", async (_label, body) => {
        const response = await CalendarsRoute.POST(
            jsonRequest("calendars", body) as never,
            undefined as never,
        );

        expect(response.status).toBe(400);
        expect(selectGoogleCalendar).not.toHaveBeenCalled();
    });

    it("400s on a non-object body", async () => {
        const response = await CalendarsRoute.POST(
            jsonRequest("calendars", "cal-1") as never,
            undefined as never,
        );

        expect(response.status).toBe(400);
    });

    it("403s a caller without staff clearance", async () => {
        vi.mocked(requireStaffSession).mockRejectedValueOnce(
            new ForbiddenError("Forbidden: insufficient clearance."),
        );

        const response = await CalendarsRoute.POST(
            jsonRequest("calendars", { createNew: true }) as never,
            undefined as never,
        );

        expect(response.status).toBe(403);
        expect(selectGoogleCalendar).not.toHaveBeenCalled();
    });
});

describe("POST /api/integrations/google-calendar/purge", () => {
    it("purges orphans for the signed-in user and reports the counts", async () => {
        vi.mocked(purgeGoogleEvents).mockResolvedValue({
            scanned: 5,
            removed: 2,
            failed: 0,
        });

        const response = await PurgeRoute.POST(
            jsonRequest("purge", { scope: "orphaned" }) as never,
            undefined as never,
        );

        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({
            scanned: 5,
            removed: 2,
            failed: 0,
        });
        expect(purgeGoogleEvents).toHaveBeenCalledWith("u1", "orphaned");
    });

    it("passes the all scope through", async () => {
        await PurgeRoute.POST(
            jsonRequest("purge", { scope: "all" }) as never,
            undefined as never,
        );

        expect(purgeGoogleEvents).toHaveBeenCalledWith("u1", "all");
    });

    it.each([
        [ "a missing scope", {} ],
        [ "an unknown scope", { scope: "everything" } ],
    ])("400s on %s", async (_label, body) => {
        const response = await PurgeRoute.POST(
            jsonRequest("purge", body) as never,
            undefined as never,
        );

        expect(response.status).toBe(400);
        expect(purgeGoogleEvents).not.toHaveBeenCalled();
    });

    it("400s when the deployment has no Google client", async () => {
        vi.mocked(isGoogleCalendarConfigured).mockReturnValue(false);

        const response = await PurgeRoute.POST(
            jsonRequest("purge", { scope: "all" }) as never,
            undefined as never,
        );

        expect(response.status).toBe(400);
        expect(purgeGoogleEvents).not.toHaveBeenCalled();
    });

    it("403s a caller without staff clearance, purging nothing", async () => {
        vi.mocked(requireStaffSession).mockRejectedValueOnce(
            new ForbiddenError("Forbidden: insufficient clearance."),
        );

        const response = await PurgeRoute.POST(
            jsonRequest("purge", { scope: "all" }) as never,
            undefined as never,
        );

        expect(response.status).toBe(403);
        expect(purgeGoogleEvents).not.toHaveBeenCalled();
    });
});
