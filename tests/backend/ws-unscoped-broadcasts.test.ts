import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    closeActiveServers,
    FakeWebSocket,
    FakeWebSocketServer,
    loadSessionServer,
    resetFakeTransport,
} from "./fake-ws";

import {
    getWsAuthKey,
    iterationSyncId,
    MessageTypes,
    signWsTicket,
    WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC,
} from "../../session-server/session-common";

/**
 * Fan-out coverage for the *unscoped* broadcast types: SETTINGS_UPDATE,
 * COURSES_UPDATE, ROOMS_UPDATE, OUTSIDERS_UPDATE, CUSTOM_COLORS_UPDATE.
 *
 * `ws-two-session-updates.test.ts` pins the iteration-scoped path (events):
 * a broadcast with `targets` set only reaches sockets subscribed to that
 * sync object. These five message types are the deliberate opposite case --
 * `SendServerRequestToSessionServer` is called for them with no `targets` at
 * all (see the doc comment on that function and every call site under
 * `ui/src/api-server/db-courses.ts`, `db-settings.ts`, `db-rooms.ts`,
 * `db-outsiders.ts`, `db-custom-colors.ts`), which the server core dispatches
 * via `dispatchMessageToEveryone` to *every* connected session regardless of
 * which iteration it's viewing.
 *
 * That "everyone" path had no test at any level before this file: the
 * per-module unit tests (e.g. db-custom-colors.test.ts) only assert the
 * broadcast call was made with a mocked sender, and the real relay's
 * everyone-fan-out behaviour for these types was never exercised. A bug that
 * accidentally scoped one of these to a sync object (or dropped it when a
 * session hadn't registered a sync-object subscription at all) would ship
 * silently -- e.g. a course-color edit by one user never appearing on
 * another logged-in user's screen, no matter which iteration either is
 * viewing.
 */

vi.mock("ws", async () => {
    const { FakeWebSocket, FakeWebSocketServer } = await import("./fake-ws");
    return { WebSocket: FakeWebSocket, WebSocketServer: FakeWebSocketServer };
});

vi.mock("@system-b90/session-ws/server", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@system-b90/session-ws/server")>();
    const { activeServers } = await import("./fake-ws");
    return {
        startSessionServer: (options?: Record<string, unknown>) => {
            const server = actual.startSessionServer(
                options as Parameters<typeof actual.startSessionServer>[0],
            );
            activeServers.push(server);
            return server;
        },
    };
});

const originalAuthKey = process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY;

beforeEach(() => {
    process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY ??= "test-root-secret";
    resetFakeTransport();
});

afterEach(() => {
    closeActiveServers();
    vi.resetModules();
});

afterAll(() => {
    process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY = originalAuthKey;
});

function openSession(
    wss: FakeWebSocketServer,
    asUser: string,
    initiatorKey: string,
    viewing?: string,
) {
    const socket = new FakeWebSocket();
    wss.emit("connection", socket, {
        url: `/?ticket=${encodeURIComponent(signWsTicket(asUser))}`,
    });
    socket.emit(
        "message",
        JSON.stringify({ type: MessageTypes.REGISTER_SESSION, initiatorKey }),
    );
    socket.emit(
        "message",
        JSON.stringify({
            type: MessageTypes.REGISTER_SYNC_PROVIDER,
            syncObjectId: iterationSyncId(viewing),
        }),
    );
    socket.sent = [];
    return socket;
}

/**
 * Mirrors `SendServerRequestToSessionServer(type, data)` called with no third
 * argument -- the real call shape for every metadata broadcast -- rather than
 * the iteration-scoped `broadcastFromServer` helper in
 * ws-two-session-updates.test.ts, which always sets `targets`.
 */
function broadcastUnscopedFromServer(
    wss: FakeWebSocketServer,
    type: MessageTypes,
    data: Record<string, unknown>,
) {
    const sender = new FakeWebSocket();
    wss.emit("connection", sender, {
        url: `/?ticket=${encodeURIComponent(
            signWsTicket(WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC),
        )}`,
    });
    sender.emit(
        "message",
        JSON.stringify({
            sender: WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC,
            authKey: getWsAuthKey(),
            type,
            data,
            // Deliberately omitted, matching every real call site for these
            // types.
        }),
    );
}

const UNSCOPED_TYPES = [
    MessageTypes.SETTINGS_UPDATE,
    MessageTypes.COURSES_UPDATE,
    MessageTypes.ROOMS_UPDATE,
    MessageTypes.OUTSIDERS_UPDATE,
    MessageTypes.CUSTOM_COLORS_UPDATE,
] as const;

describe("unscoped metadata broadcasts reach every connected session", () => {
    it.each(UNSCOPED_TYPES)(
        "%s reaches two different users viewing two different iterations",
        async (type) => {
            const wss = await loadSessionServer();
            // Different users, different iterations -- the two axes an
            // iteration-scoped broadcast (events) would fail on. An unscoped
            // broadcast must ignore both.
            const current = openSession(wss, "user-a", "initiator-a");
            const archived = openSession(wss, "user-b", "initiator-b", "2025b");

            broadcastUnscopedFromServer(wss, type, { changed: true });

            for (const [ name, tab ] of [
                [ "viewing the current iteration", current ],
                [ "viewing an archived iteration", archived ],
            ] as const) {
                expect(
                    tab.receivedOfType(type),
                    `session ${name} never received the unscoped ${type} broadcast`,
                ).toHaveLength(1);
            }
        },
    );

    it("reaches a session that has not registered any sync-object subscription", async () => {
        // Course/settings/room/outsider/color edits are not scoped to an
        // iteration a client is "viewing" at all -- a socket that only ever
        // sent REGISTER_SESSION (no REGISTER_SYNC_PROVIDER) must still get
        // these, unlike the iteration-scoped event path.
        const wss = await loadSessionServer();
        const socket = new FakeWebSocket();
        wss.emit("connection", socket, {
            url: `/?ticket=${encodeURIComponent(signWsTicket("user-a"))}`,
        });
        socket.emit(
            "message",
            JSON.stringify({
                type: MessageTypes.REGISTER_SESSION,
                initiatorKey: "initiator-a",
            }),
        );
        socket.sent = [];

        broadcastUnscopedFromServer(wss, MessageTypes.COURSES_UPDATE, {
            courses: { c1: { id: "c1", name: "מתמטיקה" } },
        });

        expect(
            socket.receivedOfType(MessageTypes.COURSES_UPDATE),
            "a session with no sync-object subscription missed the unscoped course broadcast",
        ).toHaveLength(1);
    });

    it("carries the broadcast payload through unchanged", async () => {
        const wss = await loadSessionServer();
        const tab = openSession(wss, "user-a", "initiator-a");

        broadcastUnscopedFromServer(wss, MessageTypes.CUSTOM_COLORS_UPDATE, {
            colors: { c1: { id: "c1", name: "אדום", hex: "#ff0000" } },
        });

        const [ frame ] = tab.receivedOfType(MessageTypes.CUSTOM_COLORS_UPDATE);
        expect(frame!.data).toEqual({
            colors: { c1: { id: "c1", name: "אדום", hex: "#ff0000" } },
        });
    });
});
