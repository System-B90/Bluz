import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Route-level coverage for `/api/ws-ticket` (#650 follow-up).
 *
 * `tests/backend/ws-ticket.test.ts` already pins the HMAC ticket crypto
 * itself (sign/verify round-trip, wrong secret, expired, tampered) against
 * `session-common.ts` directly. That leaves the route that actually hands a
 * ticket out untested: nothing asserted that an unauthenticated request is
 * rejected, or that the ticket issued is signed for the *actual* session
 * user rather than some other identity. A regression in `getSessionUser()`
 * wiring here — the auth gate every browser's WebSocket connection depends
 * on — would go undetected even though the crypto underneath it is solid.
 */
vi.mock("@/api-server/session-user", () => ({
    getSessionUser: vi.fn(),
}));

vi.mock("@/settings", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/settings")>();
    return {
        ...actual,
        signWsTicket: vi.fn(actual.signWsTicket),
    };
});

import { getSessionUser } from "@/api-server/session-user";
import * as WsTicketRoute from "@/app/api/ws-ticket/route";
import { signWsTicket, verifyWsTicket } from "@/settings";

beforeEach(() => {
    vi.clearAllMocks();
    // signWsTicket/verifyWsTicket read this lazily per call, but nothing
    // else in this file guarantees it's set (unlike the docker/dev env).
    process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY ??= "test-root-secret";
});

describe("GET /api/ws-ticket", () => {
    it("rejects an unauthenticated request", async () => {
        vi.mocked(getSessionUser).mockResolvedValueOnce(null);

        const res = await WsTicketRoute.GET();

        expect(res.status).toBe(401);
        expect(signWsTicket).not.toHaveBeenCalled();
    });

    it("issues a ticket signed for the actual session user", async () => {
        vi.mocked(getSessionUser).mockResolvedValueOnce({
            id: "user-42",
            displayName: "מיכאל",
        } as never);

        const res = await WsTicketRoute.GET();
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(signWsTicket).toHaveBeenCalledWith("user-42");
        // Round-trip through the real verifier: the route must not just call
        // signWsTicket with the right id, the ticket it returns must actually
        // verify as that id -- catching a mismatch between what's signed and
        // what's put on the wire.
        expect(verifyWsTicket(body.ticket)).toBe("user-42");
    });

    it("does not leak a ticket for one user under another user's identity", async () => {
        vi.mocked(getSessionUser).mockResolvedValueOnce({
            id: "user-a",
            displayName: "א",
        } as never);
        const resA = await WsTicketRoute.GET();
        const ticketA = (await resA.json()).ticket;

        vi.mocked(getSessionUser).mockResolvedValueOnce({
            id: "user-b",
            displayName: "ב",
        } as never);
        const resB = await WsTicketRoute.GET();
        const ticketB = (await resB.json()).ticket;

        expect(verifyWsTicket(ticketA)).toBe("user-a");
        expect(verifyWsTicket(ticketB)).toBe("user-b");
        expect(ticketA).not.toBe(ticketB);
    });
});
