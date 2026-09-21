import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Hanich clearance can sign in as of #656. That makes "is there a session?" an
 * insufficient gate on every route that used to rely on it, so these tests pin
 * the routes that were converted to `requireStaffSession()` — a regression here
 * hands students staff data.
 */

/*
 * The ws-ticket case signs a real ticket, and signing derives its key from this
 * secret — unset in CI, where the route's catch-all would turn the throw into a
 * 401 and quietly re-create the assertion this file used to make. Pinned the
 * same way `student-refresh-ping` and `ws-sender` pin it.
 */
process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY ??= "test-root-secret";

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
import { verifyWsTicketIdentity, WsScope } from "@/settings";
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

    it("GET /api/ws-ticket issues a hanich-scoped ticket, never a staff one", async () => {
        // Not a rejection: the student board needs the refresh channel, so the
        // route hands out a *scoped* ticket instead (#656). The scope is the
        // boundary — the session server refuses to register a hanich socket or
        // to let it listen to anything but the empty student ping — so what
        // has to hold here is that a student can never be signed as `segel`.
        const response = await WsTicketRoute.GET();
        const { ticket } = await response.json();

        expect(response.status).toBe(200);
        expect(verifyWsTicketIdentity(ticket)).toMatchObject({
            scope: WsScope.Hanich,
            userId: HANICH.id,
        });
    });

    it("GET /api/personal-settings", async () => {
        const response = await PersonalSettingsRoute.GET(
            new NextRequest("http://localhost/api/personal-settings"),
        );

        expect(response.status).toBe(403);
        expect(DbPersonalSettings.get).not.toHaveBeenCalled();
    });
});
