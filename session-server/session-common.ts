import { createHmac, timingSafeEqual } from "crypto";

export const WEBSOCKET_SESSION_SERVER_PORT = parseInt(
    process.env.WEBSOCKET_SESSION_SERVER_PORT ?? "443",
    10,
);

export const WEBSOCKET_SESSION_SERVER_HOST =
    process.env.WEBSOCKET_SESSION_SERVER_HOST ?? "127.0.0.1";

export const SECURE_CONTEXT_ONLY =
    process.env.NODE_ENV === "production" ||
    WEBSOCKET_SESSION_SERVER_PORT === 443;

export const WEBSOCKET_PROTOCOL = SECURE_CONTEXT_ONLY ? "wss" : "ws";

export const WEBSOCKET_PORT_SUFFIX =
    WEBSOCKET_SESSION_SERVER_PORT === 443 ||
    WEBSOCKET_SESSION_SERVER_PORT === 80
        ? ""
        : `:${WEBSOCKET_SESSION_SERVER_PORT}`;

export const NEXT_PUBLIC_WEBSOCKET_SESSION_SERVER_CONN_STRING = `${WEBSOCKET_PROTOCOL}://${WEBSOCKET_SESSION_SERVER_HOST}${WEBSOCKET_PORT_SUFFIX}/ws/`;
export const WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC = "server";

// Lazy: evaluated per-use (not at import time) so unrelated code that pulls
// in this module — e.g. tests, or Next.js routes that never touch WS auth —
// doesn't fail just because the env var isn't set in that context.
export function getWsAuthKey(): string {
    const key = process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY;
    if (!key) {
        throw new Error(
            "WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY environment variable has not been set!",
        );
    }
    return key;
}

const WS_TICKET_TTL_MS = 30_000;

/**
 * Signs a short-lived (30s), user-bound ticket for the browser to present on
 * WS connect, so the session server can bind the socket to a real user
 * instead of trusting a client-supplied random UUID. Cheap HMAC compare, not
 * a static shared secret sent per-message, keeps the connect path fast.
 */
export function signWsTicket(userId: string): string {
    const expiresAt = Date.now() + WS_TICKET_TTL_MS;
    const payload = `${userId}.${expiresAt}`;
    const signature = createHmac("sha256", getWsAuthKey())
        .update(payload)
        .digest("hex");
    return `${payload}.${signature}`;
}

export function verifyWsTicket(ticket: string): null | string {
    const parts = ticket.split(".");
    if (parts.length !== 3) return null;
    const [userId, expiresAtRaw, signature] = parts;
    const expiresAt = Number(expiresAtRaw);
    if (!userId || !Number.isFinite(expiresAt) || Date.now() > expiresAt) {
        return null;
    }

    const expectedSignature = createHmac("sha256", getWsAuthKey())
        .update(`${userId}.${expiresAtRaw}`)
        .digest("hex");
    const expected = Buffer.from(expectedSignature, "hex");
    const actual = Buffer.from(signature, "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        return null;
    }

    return userId;
}

export enum MessageTypes {
    REGISTER_SESSION = "register-session",
    REGISTER_SYNC_PROVIDER = "register-sync-provider",
    SYNC_OBJECT_UPDATE = "sync-object-update",
    DEREGISTER_SYNC_PROVIDER = "deregister-sync-provider",
    EVENT_DATA_UPDATE = "edu",
    EVENT_ADDED_OR_REMOVED = "ear",

    SETTINGS_UPDATE = "su",
    COURSES_UPDATE = "cu",
    ROOMS_UPDATE = "ru",
    OUTSIDERS_UPDATE = "ou",
    CUSTOM_COLORS_UPDATE = "ccu",

    // Period locking: broadcast that a user has started/finished editing an event
    EVENT_LOCK = "el",
    EVENT_UNLOCK = "eu",
}
export const COMBO_DATA_KEY = "combo-data";
