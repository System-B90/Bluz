import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Hanich clearance can sign in as of #656. That makes "is there a session?" an
 * insufficient gate on every route that used to rely on it, so these tests pin
 * the routes that were converted to `requireStaffSession()` — a regression here
 * hands students staff data.
 */

vi.mock("@/api-server/db-event-history", () => ({
    DbEventHistory: { forEvent: vi.fn(async () => []) },
}));
vi.mock("@/api-server/db-personal-settings", () => ({
    DbPersonalSettings: { get: vi.fn(async () => ({})), set: vi.fn() },
}));
vi.mock("@/api-server/iteration-request", () => ({
    resolveIterationFromRequest: vi.fn(async () => ({ controller: {} })),
}));

import { DbEventHistory } from "@/api-server/db-event-history";
import { DbPersonalSettings } from "@/api-server/db-personal-settings";
import { Clearance } from "@/api-shared/types/hive";
import * as EventHistoryRoute from "@/app/api/event/history/route";
import * as PersonalSettingsRoute from "@/app/api/personal-settings/route";
import * as WsTicketRoute from "@/app/api/ws-ticket/route";

const HANICH = { id: "s1", display_name: "חניך", clearance: Clearance.Hanich };

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: HANICH } as never);
});

describe("staff-only routes reject a Hanich session", () => {
    it("GET /api/event/history", async () => {
        const response = await EventHistoryRoute.GET(
            new NextRequest(
                "http://localhost/api/event/history?id=11111111-1111-4111-8111-111111111111",
            ),
        );

        expect(response.status).toBe(403);
        expect(DbEventHistory.forEvent).not.toHaveBeenCalled();
    });

    it("GET /api/ws-ticket", async () => {
        // The socket broadcasts whole event documents; a ticket is a bypass of
        // the entire student projection.
        const response = await WsTicketRoute.GET();

        expect(response.status).toBe(401);
        expect(await response.text()).not.toContain("ticket");
    });

    it("GET /api/personal-settings", async () => {
        const response = await PersonalSettingsRoute.GET(
            new NextRequest("http://localhost/api/personal-settings"),
        );

        expect(response.status).toBe(403);
        expect(DbPersonalSettings.get).not.toHaveBeenCalled();
    });
});
