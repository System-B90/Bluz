import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MessageTypes, signWsTicket } from "../../session-server/session-common";

/**
 * Tests for the session-server relay (session-server/session-server.ts).
 *
 * The entry is a thin options object over the shared core in
 * @system-b90/session-ws/server, so these tests run the REAL core against a
 * fake `ws` transport: WebSocketServer/WebSocket are replaced with in-memory
 * fakes and connections are driven by emitting `connection` / `message`
 * directly. Nothing binds to a port and nothing touches the network, while
 * the full pipeline (ticket gate -> parse -> type gate -> relay hook ->
 * fan-out) still executes.
 *
 * Deliberately NOT covered here: a frame whose body is the literal `null`.
 * On this branch it crashes the core's message listener (#511); the stay-up
 * guard and shape check live on the branch fixing #511, and a test for the
 * guarded behavior belongs with that fix, not here.
 */
class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = FakeWebSocket.OPEN;
    sent: Array<string> = [];
    closedWith: Array<[ code: number | undefined, reason: string | undefined ]> = [];

    private handlers = new Map<string, Array<(...args: Array<any>) => void>>();

    send(data: string) {
        this.sent.push(String(data));
    }

    close(code?: number, reason?: string) {
        this.closedWith.push([ code, reason ]);
        this.readyState = FakeWebSocket.CLOSED;
    }

    // The core terminates unresponsive heartbeats; not under test here.
    terminate() {
        this.readyState = FakeWebSocket.CLOSED;
    }

    ping() {}

    on(event: string, handler: (...args: Array<any>) => void) {
        const handlers = this.handlers.get(event) ?? [];
        handlers.push(handler);
        this.handlers.set(event, handlers);
    }

    /** Test-side trigger for handlers the core registered via `on`. */
    emit(event: string, ...args: Array<any>) {
        for (const handler of this.handlers.get(event) ?? []) {
            handler(...args);
        }
    }
}

class FakeWebSocketServer {
    static instances: Array<FakeWebSocketServer> = [];

    options: Record<string, unknown>;

    private handlers = new Map<string, Array<(...args: Array<any>) => void>>();

    constructor(options: Record<string, unknown>) {
        this.options = options;
        FakeWebSocketServer.instances.push(this);
    }

    on(event: string, handler: (...args: Array<any>) => void) {
        const handlers = this.handlers.get(event) ?? [];
        handlers.push(handler);
        this.handlers.set(event, handlers);
    }

    emit(event: string, ...args: Array<any>) {
        for (const handler of this.handlers.get(event) ?? []) {
            handler(...args);
        }
    }

    close(onClose?: () => void) {
        onClose?.();
    }
}

// Captured from the real core so tests can drive connections and assert the
// options session-server.ts wires in.
let serverOptions: Record<string, unknown> | undefined;
let activeServers: Array<{ close: () => void }> = [];

vi.mock("ws", () => ({ WebSocket: FakeWebSocket, WebSocketServer: FakeWebSocketServer }));

vi.mock("@system-b90/session-ws/server", async (importOriginal) => {
    const actual = await importOriginal<
        typeof import("@system-b90/session-ws/server")
    >();
    return {
        startSessionServer: (options?: Record<string, unknown>) => {
            serverOptions = options;
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
    process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY = "test-secret";
    serverOptions = undefined;
});

afterEach(() => {
    for (const server of activeServers) {
        server.close();
    }
    activeServers = [];
    FakeWebSocketServer.instances = [];
});

afterAll(() => {
    process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY = originalAuthKey;
});

async function loadServer() {
    vi.resetModules();
    const serverModule = await import("../../session-server/session-server");
    const wss = FakeWebSocketServer.instances.at(-1);
    if (!wss) {
        throw new Error("startSessionServer did not construct a WebSocketServer");
    }
    return { serverModule, wss };
}

function connectClient(
    wss: FakeWebSocketServer,
    identity: { asUser?: string; rawTicket?: string } = {},
) {
    // Tickets are really HMAC-signed (same code path as production); only the
    // socket transport underneath is faked.
    const client = new FakeWebSocket();
    const url =
        identity.asUser !== undefined
            ? `/?ticket=${encodeURIComponent(signWsTicket(identity.asUser))}`
            : identity.rawTicket !== undefined
              ? `/?ticket=${encodeURIComponent(identity.rawTicket)}`
              : "/";
    wss.emit("connection", client, { url });
    return client;
}

function registerSession(client: FakeWebSocket, initiatorKey: string) {
    client.emit(
        "message",
        JSON.stringify({ type: "register-session", initiatorKey }),
    );
}

// Lock/unlock relay is now dispatched as a targeted sync-object fan-out
// scoped to the viewed iteration rather than a broadcast to every registered
// session (#525) — the production client subscribes via
// REGISTER_SYNC_PROVIDER before it can receive one (UseEventWebsocket.ts).
// "iteration:current" is what iterationSyncId(undefined) resolves to, which
// is what these tests' lock/unlock frames carry (no iterationId in payload).
const CURRENT_ITERATION_SYNC_ID = "iteration:current";

function subscribeToSyncObject(client: FakeWebSocket, syncObjectId: string) {
    client.emit(
        "message",
        JSON.stringify({ type: "register-sync-provider", syncObjectId }),
    );
}

describe("session-server relay", () => {
    it("relays EVENT_LOCK from one client to every registered client", async () => {
        await loadServer();
        const sender = connectClient(FakeWebSocketServer.instances[0], { asUser: "user-a" });
        const peer = connectClient(FakeWebSocketServer.instances[0], { asUser: "user-b" });
        registerSession(sender, "initiator-a");
        registerSession(peer, "initiator-b");
        subscribeToSyncObject(sender, CURRENT_ITERATION_SYNC_ID);
        subscribeToSyncObject(peer, CURRENT_ITERATION_SYNC_ID);

        sender.emit(
            "message",
            JSON.stringify({ type: "el", data: { eventId: "event-1" } }),
        );

        // The fan-out is a single serialized frame delivered to everyone
        // subscribed to the viewed iteration, including the sender (it
        // filters its own lock out client-side).
        expect(peer.sent).toHaveLength(1);
        const relayed = JSON.parse(peer.sent[0]);
        expect(relayed).toEqual({
            type: "el",
            target: CURRENT_ITERATION_SYNC_ID,
            // lockedById is stamped from the sender's ticket, not the frame
            // (#540 item 2).
            data: { eventId: "event-1", lockedById: "user-a" },
        });
        expect(sender.sent).toEqual(peer.sent);
    });

    it("overwrites a forged lockedById with the ticket's user (#540.2)", async () => {
        await loadServer();
        const sender = connectClient(FakeWebSocketServer.instances[0], { asUser: "user-a" });
        const peer = connectClient(FakeWebSocketServer.instances[0], { asUser: "user-b" });
        registerSession(sender, "initiator-a");
        registerSession(peer, "initiator-b");
        subscribeToSyncObject(sender, CURRENT_ITERATION_SYNC_ID);
        subscribeToSyncObject(peer, CURRENT_ITERATION_SYNC_ID);

        sender.emit(
            "message",
            JSON.stringify({
                type: "el",
                data: {
                    eventId: "event-1",
                    lockedById: "somebody-else",
                    lockedByName: "Somebody Else",
                },
            }),
        );

        const relayed = JSON.parse(peer.sent[0]);
        // A client may only ever claim to be itself; without this it could show
        // a forged "X is editing" badge on any event to everyone.
        expect(relayed.data.lockedById).toBe("user-a");
        expect(relayed.data.eventId).toBe("event-1");
    });

    it("drops a lock frame whose payload is not an object", async () => {
        await loadServer();
        const sender = connectClient(FakeWebSocketServer.instances[0], { asUser: "user-a" });
        const peer = connectClient(FakeWebSocketServer.instances[0], { asUser: "user-b" });
        registerSession(sender, "initiator-a");
        registerSession(peer, "initiator-b");

        sender.emit("message", JSON.stringify({ type: "el", data: "nope" }));

        expect(peer.sent).toHaveLength(0);
    });

    it("relays EVENT_UNLOCK the same way", async () => {
        await loadServer();
        const sender = connectClient(FakeWebSocketServer.instances[0], { asUser: "user-a" });
        const peer = connectClient(FakeWebSocketServer.instances[0], { asUser: "user-b" });
        registerSession(sender, "initiator-a");
        registerSession(peer, "initiator-b");
        subscribeToSyncObject(sender, CURRENT_ITERATION_SYNC_ID);
        subscribeToSyncObject(peer, CURRENT_ITERATION_SYNC_ID);

        sender.emit(
            "message",
            JSON.stringify({ type: "eu", data: { eventId: "event-1" } }),
        );

        expect(peer.sent).toHaveLength(1);
        expect(JSON.parse(peer.sent[0])).toEqual({
            type: "eu",
            target: CURRENT_ITERATION_SYNC_ID,
            data: { eventId: "event-1", lockedById: "user-a" },
        });
    });

    it("drops an unlock frame carrying no payload", async () => {
        await loadServer();
        const sender = connectClient(FakeWebSocketServer.instances[0], { asUser: "user-a" });
        const peer = connectClient(FakeWebSocketServer.instances[0], { asUser: "user-b" });
        registerSession(sender, "initiator-a");
        registerSession(peer, "initiator-b");

        sender.emit("message", JSON.stringify({ type: "eu" }));

        // Previously this relayed `data: undefined`, and the receiving client
        // then read `msg.eventId` off it. A payload-less unlock says nothing,
        // so it is dropped at the relay instead.
        expect(peer.sent).toHaveLength(0);
    });

    it("only fans out to clients that registered a session", async () => {
        await loadServer();
        const sender = connectClient(FakeWebSocketServer.instances[0], { asUser: "user-a" });
        const unregistered = connectClient(FakeWebSocketServer.instances[0], {
            asUser: "user-b",
        });
        registerSession(sender, "initiator-a");
        subscribeToSyncObject(sender, CURRENT_ITERATION_SYNC_ID);
        // Deliberately not subscribed to the sync object.

        sender.emit(
            "message",
            JSON.stringify({ type: "el", data: { eventId: "event-1" } }),
        );

        // Shared-core contract the browser client depends on: a socket that
        // has not subscribed to the iteration's sync object stays out of the
        // targeted fan-out (#525), regardless of session registration.
        expect(sender.sent).toHaveLength(1);
        expect(unregistered.sent).toHaveLength(0);
    });

    it("drops unknown message types without disconnecting the sender", async () => {
        await loadServer();
        const client = connectClient(FakeWebSocketServer.instances[0], { asUser: "user-a" });
        registerSession(client, "initiator-a");

        client.emit("message", JSON.stringify({ type: "not-a-real-type" }));

        expect(client.sent).toHaveLength(0);
        expect(client.closedWith).toHaveLength(0);
        expect(client.readyState).toBe(FakeWebSocket.OPEN);
    });

    it("drops valid-vocabulary frames the hook does not handle", async () => {
        await loadServer();
        const sender = connectClient(FakeWebSocketServer.instances[0], { asUser: "user-a" });
        const peer = connectClient(FakeWebSocketServer.instances[0], { asUser: "user-b" });
        registerSession(sender, "initiator-a");
        registerSession(peer, "initiator-b");

        // "edu" is in the wire vocabulary but the relay hook returns false
        // for it, so nothing is broadcast and nobody is disconnected.
        sender.emit(
            "message",
            JSON.stringify({ type: "edu", data: { eventId: "event-1" } }),
        );

        expect(sender.sent).toHaveLength(0);
        expect(peer.sent).toHaveLength(0);
        expect(sender.closedWith).toHaveLength(0);
    });

    it("ignores frames that are not valid JSON", async () => {
        await loadServer();
        const client = connectClient(FakeWebSocketServer.instances[0], { asUser: "user-a" });
        registerSession(client, "initiator-a");

        client.emit("message", "{definitely not json");

        expect(client.sent).toHaveLength(0);
        expect(client.closedWith).toHaveLength(0);
        expect(client.readyState).toBe(FakeWebSocket.OPEN);
    });
});

describe("session-server ticket gate", () => {
    it("rejects an unticketed connection with 1008 and never registers it", async () => {
        await loadServer();
        const wss = FakeWebSocketServer.instances[0];
        const rejected = connectClient(wss);
        const registered = connectClient(wss, { asUser: "user-a" });
        registerSession(registered, "initiator-a");

        expect(rejected.closedWith).toEqual([
            [ 1008, "Invalid or missing ticket" ],
        ]);

        registered.emit("message", JSON.stringify({ type: "el" }));
        expect(rejected.sent).toHaveLength(0);
    });

    it("rejects an invalid ticket the same way", async () => {
        await loadServer();
        const rejected = connectClient(FakeWebSocketServer.instances[0], {
            rawTicket: "garbage.ticket.signature",
        });

        expect(rejected.closedWith).toEqual([
            [ 1008, "Invalid or missing ticket" ],
        ]);
    });
});

describe("session-server wiring", () => {
    it("hands the complete Bluz wire vocabulary to the shared core", async () => {
        await loadServer();

        // The core drops frames whose type is outside this set BEFORE the
        // relay hook runs, so a missing value here silently kills that
        // broadcast type.
        expect(serverOptions, "serverOptions was never captured").toBeDefined();
        const passed = new Set(
            (serverOptions?.validMessageTypes as Array<string>) ?? [],
        );
        for (const messageType of Object.values(MessageTypes)) {
            expect(passed.has(messageType)).toBe(true);
        }
    });

    it("exposes the core's WebSocketServer as its default export", async () => {
        const { serverModule, wss } = await loadServer();

        expect(serverModule.default).toBe(wss);
    });
});
