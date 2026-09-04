import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api-server/db-personal-settings", () => ({
    DbPersonalSettings: { get: vi.fn(), set: vi.fn() },
}));
vi.mock("@/api-server/google/google-calendar-service", () => ({
    isGoogleCalendarConfigured: vi.fn(() => true),
    isGoogleCalendarConnected: vi.fn(async () => true),
    getGoogleClientId: vi.fn(() => "client-id.apps.googleusercontent.com"),
    getGoogleScopes: vi.fn(() => [ "https://www.googleapis.com/auth/calendar" ]),
    disconnectGoogleCalendar: vi.fn(async () => undefined),
}));
vi.mock("@/api-server/session-user", () => ({
    getSessionUser: vi.fn(async () => ({ id: "u1" })),
    requireStaffSession: vi.fn(async () => undefined),
}));

import { DbPersonalSettings } from "@/api-server/db-personal-settings";
import {
    disconnectGoogleCalendar,
    isGoogleCalendarConfigured,
    isGoogleCalendarConnected,
} from "@/api-server/google/google-calendar-service";
import { getSessionUser } from "@/api-server/session-user";
import * as DisconnectRoute from "@/app/api/integrations/google-calendar/disconnect/route";
import * as StatusRoute from "@/app/api/integrations/google-calendar/status/route";

const anyRequest = new Request(
    "http://localhost/api/integrations/google-calendar/status",
);

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionUser).mockResolvedValue({ id: "u1" } as never);
    vi.mocked(isGoogleCalendarConfigured).mockReturnValue(true);
    vi.mocked(isGoogleCalendarConnected).mockResolvedValue(true);
    vi.mocked(DbPersonalSettings.get).mockResolvedValue({
        googleCalendarEnabled: true,
    } as never);
});

describe("GET /api/integrations/google-calendar/status", () => {
    it("reports configuration, connection, the user's toggle and the GIS inputs", async () => {
        const response = await StatusRoute.GET(anyRequest, undefined as never);

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect((await response.json()).data).toEqual({
            configured: true,
            connected: true,
            enabled: true,
            clientId: "client-id.apps.googleusercontent.com",
            scopes: [ "https://www.googleapis.com/auth/calendar" ],
        });
        expect(isGoogleCalendarConnected).toHaveBeenCalledWith("u1");
        expect(DbPersonalSettings.get).toHaveBeenCalledWith("u1");
    });

    it("reports an unconfigured deployment without claiming a connection", async () => {
        vi.mocked(isGoogleCalendarConfigured).mockReturnValue(false);
        vi.mocked(isGoogleCalendarConnected).mockResolvedValue(false);

        const { data } = await (
            await StatusRoute.GET(anyRequest, undefined as never)
        ).json();

        expect(data.configured).toBe(false);
        expect(data.connected).toBe(false);
    });

    it("401s an anonymous caller", async () => {
        vi.mocked(getSessionUser).mockResolvedValueOnce(null as never);

        const response = await StatusRoute.GET(anyRequest, undefined as never);

        expect(response.status).toBe(401);
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

    it("401s an anonymous caller, disconnecting nothing", async () => {
        vi.mocked(getSessionUser).mockResolvedValueOnce(null as never);

        const response = await DisconnectRoute.POST(
            anyRequest,
            undefined as never,
        );

        expect(response.status).toBe(401);
        expect(disconnectGoogleCalendar).not.toHaveBeenCalled();
    });
});
