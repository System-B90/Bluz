import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Route-level coverage for `/api/ws-ticket` (#650 follow-up).
 *
 * `tests/backend/ws-ticket.test.ts` already pins the HMAC ticket crypto
 * itself (sign/verify round-trip, wrong secret, expired, tampered) against
 * `session-common.ts` directly. That leaves the route that actually hands a
 * ticket out untested: nothing asserted that an unauthenticated request is
 * rejected, or that the ticket issued is signed for the *actual* session
 * user rather than some other identity. A regression in the auth wiring here —
 * the gate every browser's WebSocket connection depends on — would go
 * undetected even though the crypto underneath it is solid.
 *
 * Students hold sessions as of #656, so the route no longer gates on staff
 * clearance; it gates on *scope*. The ticket a student gets is signed
 * `hanich`, which is what the session server refuses to register as a session
 * or to subscribe to any calendar sync object. Issuing the wrong scope here
 * would hand a student the full staff wire, so the scope is asserted per
 * clearance below.
 */
vi.mock("@/api-server/student-view", () => ({
    requireStudentViewSession: vi.fn(),
}));

vi.mock("@/settings", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/settings")>();
    return {
        ...actual,
        signWsTicket: vi.fn(actual.signWsTicket),
    };
});

import { requireStudentViewSession } from "@/api-server/student-view";
import { ForbiddenError } from "@/api-shared/errors";
import * as WsTicketRoute from "@/app/api/ws-ticket/route";
import { signWsTicket, verifyWsTicketIdentity, WsScope } from "@/settings";

beforeEach(() => {
    vi.clearAllMocks();
    // signWsTicket/verifyWsTicket read this lazily per call, but nothing
    // else in this file guarantees it's set (unlike the docker/dev env).
    process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY ??= "test-root-secret";
});

describe("GET /api/ws-ticket", () => {
    it("rejects a caller with no session at all", async () => {
        vi.mocked(requireStudentViewSession).mockRejectedValueOnce(
            new ForbiddenError("Forbidden: insufficient clearance."),
        );

        const res = await WsTicketRoute.GET();

        expect(res.status).toBe(401);
        expect(signWsTicket).not.toHaveBeenCalled();
    });

    it("issues a ticket signed for the actual session user", async () => {
        vi.mocked(requireStudentViewSession).mockResolvedValueOnce({
            isStaff: true,
            userId: "user-42",
        } as never);

        const res = await WsTicketRoute.GET();
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(signWsTicket).toHaveBeenCalledWith("user-42", WsScope.Segel);
        // Round-trip through the real verifier: the route must not just call
        // signWsTicket with the right id, the ticket it returns must actually
        // verify as that id -- catching a mismatch between what's signed and
        // what's put on the wire.
        expect(verifyWsTicketIdentity(body.ticket)).toMatchObject({
            scope: WsScope.Segel,
            userId: "user-42",
        });
    });

    it("does not leak a ticket for one user under another user's identity", async () => {
        vi.mocked(requireStudentViewSession).mockResolvedValueOnce({
            isStaff: true,
            userId: "user-a",
        } as never);
        const resA = await WsTicketRoute.GET();
        const ticketA = (await resA.json()).ticket;

        vi.mocked(requireStudentViewSession).mockResolvedValueOnce({
            isStaff: true,
            userId: "user-b",
        } as never);
        const resB = await WsTicketRoute.GET();
        const ticketB = (await resB.json()).ticket;

        expect(verifyWsTicketIdentity(ticketA)?.userId).toBe("user-a");
        expect(verifyWsTicketIdentity(ticketB)?.userId).toBe("user-b");
        expect(ticketA).not.toBe(ticketB);
    });
});

describe("ticket scope follows clearance", () => {
    it("signs a student's ticket `hanich`, not `segel`", async () => {
        vi.mocked(requireStudentViewSession).mockResolvedValueOnce({
            isStaff: false,
            userId: "student-1",
        } as never);

        const res = await WsTicketRoute.GET();
        const { ticket } = await res.json();

        expect(verifyWsTicketIdentity(ticket)).toMatchObject({
            scope: WsScope.Hanich,
            userId: "student-1",
        });
    });

    it("issues a student a ticket at all — they need the refresh ping", async () => {
        vi.mocked(requireStudentViewSession).mockResolvedValueOnce({
            isStaff: false,
            userId: "student-1",
        } as never);

        expect((await WsTicketRoute.GET()).status).toBe(200);
    });
});
