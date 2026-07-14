import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("signWsTicket / verifyWsTicket", () => {
    const originalKey = process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY;

    beforeEach(() => {
        process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY = "test-secret";
    });

    afterEach(() => {
        process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY = originalKey;
    });

    it("round-trips a valid ticket back to the signing userId", async () => {
        const { signWsTicket, verifyWsTicket } = await import(
            "../../session-server/session-common"
        );
        const ticket = signWsTicket("user-123");
        expect(verifyWsTicket(ticket)).toBe("user-123");
    });

    it("rejects a ticket signed with a different secret", async () => {
        const { signWsTicket, verifyWsTicket } = await import(
            "../../session-server/session-common"
        );
        const ticket = signWsTicket("user-123");
        process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY = "other-secret";
        expect(verifyWsTicket(ticket)).toBeNull();
    });

    it("rejects an expired ticket", async () => {
        const { verifyWsTicket } = await import(
            "../../session-server/session-common"
        );
        const expiredTicket = "user-123.1.deadbeef";
        expect(verifyWsTicket(expiredTicket)).toBeNull();
    });

    it("rejects a malformed ticket", async () => {
        const { verifyWsTicket } = await import(
            "../../session-server/session-common"
        );
        expect(verifyWsTicket("not-a-ticket")).toBeNull();
        expect(verifyWsTicket("")).toBeNull();
    });

    it("rejects a tampered signature", async () => {
        const { signWsTicket, verifyWsTicket } = await import(
            "../../session-server/session-common"
        );
        const ticket = signWsTicket("user-123");
        const [userId, expiresAt] = ticket.split(".");
        const tampered = `${userId}.${expiresAt}.${"0".repeat(64)}`;
        expect(verifyWsTicket(tampered)).toBeNull();
    });
});
