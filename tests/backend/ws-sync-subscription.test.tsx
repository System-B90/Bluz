// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import React from "react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionWebSocketContext } from "@system-b90/session-ws/react";

import { iterationSyncId, MessageTypes, signWsTicket } from "../../session-server/session-common";

/**
 * Regression tests for the iteration-scoped sync-object subscription
 * lifecycle introduced by #525 / PR #600.
 *
 * Since #525 the server no longer broadcasts calendar traffic to every
 * logged-in browser: a client must send REGISTER_SYNC_PROVIDER for the
 * iteration it is viewing, and only those registered listeners receive
 * EVENT_DATA_UPDATE / EVENT_ADDED_OR_REMOVED / lock frames for it.
 *
 * That makes the subscription load-bearing for correctness, and its lifecycle
 * is currently broken in two independent ways. Both are silent: the socket
 * stays connected, no error surfaces, the calendar simply stops updating and
 * shows stale data until the user reloads the page.
 *
 * These tests are expected to FAIL on master — they document the bug.
 *
 * Style follows tests/backend/ws-session-server.test.ts: the REAL shared core
 * runs against an in-memory fake `ws` transport (server side), and the REAL
 * client hook runs in jsdom against a fake browser WebSocket (client side).
 * Nothing binds a port and nothing touches the network.
 */

/* ------------------------------------------------------------------ */
/* Server-side fake `ws` transport (mirrors ws-session-server.test.ts) */
/* ------------------------------------------------------------------ */

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
        this.emit("close");
    }

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

let activeServers: Array<{ close: () => void }> = [];

vi.mock("ws", () => ({ WebSocket: FakeWebSocket, WebSocketServer: FakeWebSocketServer }));

vi.mock("@system-b90/session-ws/server", async (importOriginal) => {
    const actual = await importOriginal<
        typeof import("@system-b90/session-ws/server")
    >();
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

// The calendar consumer reads the signed-in user from AuthProvider; only the
// auth surface is faked, the websocket plumbing it hands down is the real
// package hook (wired in by the test component below).
let currentAuth: {
    addMessageHandler: (handler: unknown) => () => void;
    sendMessage: (data: unknown) => void;
    registerSyncObject: (syncObjectId: string) => void;
    deregisterSyncObject: (syncObjectId: string) => void;
} = {
    addMessageHandler: () => () => {},
    sendMessage: () => {},
    registerSyncObject: () => {},
    deregisterSyncObject: () => {},
};

vi.mock("@/components/auth/AuthProvider", () => ({
    useAuth: () => currentAuth,
}));

const originalAuthKey = process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY;

beforeEach(() => {
    process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY = "test-secret";
});

afterEach(() => {
    for (const server of activeServers) {
        server.close();
    }
    activeServers = [];
    FakeWebSocketServer.instances = [];
    vi.restoreAllMocks();
});

afterAll(() => {
    process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY = originalAuthKey;
});

async function loadServer() {
    vi.resetModules();
    await import("../../session-server/session-server");
    const wss = FakeWebSocketServer.instances.at(-1);
    if (!wss) {
        throw new Error("startSessionServer did not construct a WebSocketServer");
    }
    return wss;
}

function connectClient(wss: FakeWebSocketServer, asUser: string) {
    const client = new FakeWebSocket();
    wss.emit("connection", client, {
        url: `/?ticket=${encodeURIComponent(signWsTicket(asUser))}`,
    });
    return client;
}

function registerSession(client: FakeWebSocket, initiatorKey: string) {
    client.emit(
        "message",
        JSON.stringify({ type: "register-session", initiatorKey }),
    );
}

function subscribeToSyncObject(client: FakeWebSocket, syncObjectId: string) {
    client.emit(
        "message",
        JSON.stringify({ type: "register-sync-provider", syncObjectId }),
    );
}

/* ------------------------------------------------------------------ */
/* Server-side truth: a reconnect starts from zero subscriptions       */
/* ------------------------------------------------------------------ */

describe("sync-object subscription lifecycle (server side)", () => {
    it("delivers iteration-scoped broadcasts only to the socket that registered", async () => {
        // Baseline for the regression below: with a live registration the
        // fan-out does reach the client. If this ever fails, the reconnect
        // test underneath is not testing what it claims to.
        const wss = await loadServer();
        const viewer = connectClient(wss, "user-a");
        const peer = connectClient(wss, "user-b");
        registerSession(viewer, "initiator-a");
        registerSession(peer, "initiator-b");
        subscribeToSyncObject(viewer, iterationSyncId(undefined));

        peer.emit(
            "message",
            JSON.stringify({ type: MessageTypes.EVENT_LOCK, data: { eventId: "event-1" } }),
        );

        expect(viewer.sent).toHaveLength(1);
    });

    it("stops delivering to a reconnected socket that only re-registers its session", async () => {
        const wss = await loadServer();
        const viewer = connectClient(wss, "user-a");
        const peer = connectClient(wss, "user-b");
        registerSession(viewer, "initiator-a");
        registerSession(peer, "initiator-b");
        subscribeToSyncObject(viewer, iterationSyncId(undefined));

        // The socket drops (wifi blip, laptop sleep, proxy idle timeout).
        // `removeConnection` in the shared core clears this socket's
        // syncObjectIds, so the server-side subscription is gone for good.
        viewer.close(1006, "connection lost");

        const reconnected = connectClient(wss, "user-a");
        registerSession(reconnected, "initiator-a-2");

        peer.emit(
            "message",
            JSON.stringify({ type: MessageTypes.EVENT_LOCK, data: { eventId: "event-2" } }),
        );

        // This is correct server behaviour, pinned deliberately: subscriptions
        // are per-socket and are not resurrected for a reconnecting user. It is
        // precisely *why* the client must replay them on open -- the server
        // will never do it on the client's behalf, so a transport that treats a
        // subscription as a one-off message goes silently deaf after the first
        // reconnect (the #525 regression). The client-side counterpart, that
        // the hook does replay, is asserted below.
        expect(
            reconnected.sent.map((frame) => JSON.parse(frame)),
            "a reconnected socket that never re-registers must receive nothing",
        ).toHaveLength(0);
    });
});

/* ------------------------------------------------------------------ */
/* Client-side fake browser WebSocket                                  */
/* ------------------------------------------------------------------ */

class FakeBrowserWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    static instances: Array<FakeBrowserWebSocket> = [];

    readyState: number = FakeBrowserWebSocket.CONNECTING;
    sent: Array<string> = [];

    onopen: null | (() => void) = null;
    onclose: null | (() => void) = null;
    onmessage: null | ((ev: { data: string }) => void) = null;
    onerror: null | (() => void) = null;

    constructor(
        public url: string,
        public protocols?: string | Array<string>,
    ) {
        FakeBrowserWebSocket.instances.push(this);
    }

    send(data: string) {
        this.sent.push(String(data));
    }

    close() {
        this.readyState = FakeBrowserWebSocket.CLOSED;
        this.onclose?.();
    }

    /** Test-side trigger: the server accepted the connection. */
    open() {
        this.readyState = FakeBrowserWebSocket.OPEN;
        this.onopen?.();
    }

    /** Every frame this socket put on the wire, parsed. */
    frames() {
        return this.sent.map((frame) => JSON.parse(frame));
    }
}

/** The frames a socket sent that subscribe to an iteration's sync object. */
function registerSyncFrames(socket: FakeBrowserWebSocket) {
    return socket
        .frames()
        .filter((frame) => frame.type === MessageTypes.REGISTER_SYNC_PROVIDER);
}

/**
 * Renders the real calendar websocket consumer on top of the real
 * `useSessionWebSocketContext` hook from @system-b90/session-ws, exactly as
 * AuthProvider composes them in production.
 */
function makeConsumer(useEventWebsocket: typeof import(
    "@/components/schedule/calendar/calendar-provider/hooks/UseEventWebsocket"
)["useEventWebsocket"]) {
    return function Consumer({ iterationId }: { iterationId?: string }) {
        const {
            addMessageHandler,
            sendMessage,
            registerSyncObject,
            deregisterSyncObject,
        } = useSessionWebSocketContext();
        // AuthProvider hands these straight down; the mocked useAuth returns them.
        currentAuth = {
            addMessageHandler,
            sendMessage,
            registerSyncObject,
            deregisterSyncObject,
        } as typeof currentAuth;
        useEventWebsocket(
            false,
            () => {},
            () => {},
            iterationId,
        );
        return null;
    };
}

async function loadConsumer() {
    const module = await import(
        "@/components/schedule/calendar/calendar-provider/hooks/UseEventWebsocket"
    );
    return makeConsumer(module.useEventWebsocket);
}

function installFakeBrowserSocket() {
    FakeBrowserWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeBrowserWebSocket);
}

/** A ticket endpoint that resolves immediately. */
function stubTicketFetch() {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true, json: async () => ({ ticket: "test-ticket" }) })),
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

/* ------------------------------------------------------------------ */
/* (A) The client never re-registers after a reconnect                 */
/* ------------------------------------------------------------------ */

describe("useEventWebsocket subscription over a reconnect (client side)", () => {
    it("never sends a second REGISTER_SYNC_PROVIDER after the socket reconnects", async () => {
        // The hook reconnects on a backoff timer; freeze time so the test
        // drives that timer instead of waiting 500ms of wall clock.
        vi.useFakeTimers();
        installFakeBrowserSocket();
        stubTicketFetch();
        const Consumer = await loadConsumer();

        const view = render(<Consumer />);
        // Let the ticket fetch settle so the socket exists, then open it.
        await act(async () => {});
        const first = FakeBrowserWebSocket.instances[0];
        expect(first, "no WebSocket was constructed").toBeDefined();
        await act(async () => {
            first.open();
        });

        // Switch to a concrete iteration while the socket is OPEN so the
        // subscription genuinely lands on the wire. This isolates the
        // reconnect bug from the separate "dropped while connecting" bug.
        await act(async () => {
            view.rerender(<Consumer iterationId="iter-1" />);
        });
        expect(
            registerSyncFrames(first).map((f) => f.syncObjectId),
            "the initial subscription never reached the wire",
        ).toContain(iterationSyncId("iter-1"));

        // The socket drops and the hook's backoff brings up a new one.
        await act(async () => {
            first.close();
        });
        await act(async () => {
            // Drive the reconnect timer the hook scheduled in `onclose`.
            await vi.advanceTimersByTimeAsync(1000);
        });
        // The successor socket is up; opening it gives the package's `onopen`
        // its chance to replay subscriptions.
        const second = FakeBrowserWebSocket.instances.at(-1);
        expect(second, "reconnect did not construct a new socket").not.toBe(first);
        expect(second, "no socket was constructed after the close").toBeDefined();
        await act(async () => {
            second!.open();
        });

        // Real-world consequence: after any blip the calendar is subscribed to
        // nothing. It still looks connected, but no EVENT_DATA_UPDATE or
        // EVENT_ADDED_OR_REMOVED ever arrives again — the schedule silently
        // shows stale data until the user reloads.
        //
        // Nothing re-registers, because the hook's effect deps are
        // [activeIterationId, sendMessage] and `sendMessage` is a
        // useCallback(..., []) — a permanently stable reference — while the
        // package's `onopen` replays only REGISTER_SESSION and the queue.
        expect(
            registerSyncFrames(second!).map((f) => f.syncObjectId),
            "the reconnected socket sent no REGISTER_SYNC_PROVIDER: the subscription was never replayed",
        ).toContain(iterationSyncId("iter-1"));
    });
});

/* ------------------------------------------------------------------ */
/* (B) The very first registration can be discarded outright           */
/* ------------------------------------------------------------------ */

describe("registration sent while the ticket fetch is still in flight", () => {
    it("does not discard REGISTER_SYNC_PROVIDER when the socket does not exist yet", async () => {
        installFakeBrowserSocket();
        // The real ticket endpoint is a network round trip. `connect()` awaits
        // it BEFORE assigning `ws.current`, so for that whole window
        // `ws.current` is null while the mount effect is already sending its
        // subscription.
        let releaseTicket: () => void = () => {};
        const ticketReady = new Promise<void>((resolve) => {
            releaseTicket = resolve;
        });
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => {
                await ticketReady;
                return { ok: true, json: async () => ({ ticket: "test-ticket" }) };
            }),
        );

        const Consumer = await loadConsumer();
        render(<Consumer iterationId="iter-1" />);
        // Mount effects have run; the subscription has been "sent" while the
        // ticket request is still outstanding and no socket object exists.
        await act(async () => {});
        expect(
            FakeBrowserWebSocket.instances,
            "socket must not exist yet for this test to be meaningful",
        ).toHaveLength(0);

        // Now the ticket arrives, the socket is constructed and opens.
        await act(async () => {
            releaseTicket();
        });
        const socket = FakeBrowserWebSocket.instances[0];
        expect(socket, "no WebSocket was constructed after the ticket resolved").toBeDefined();
        await act(async () => {
            socket.open();
        });

        // Real-world consequence: on a cold page load with a slow ticket
        // endpoint the calendar subscribes to nothing at all and never
        // retries — `subscribedSyncId.current` was set regardless, so the hook
        // believes it is subscribed. The user watches an empty, never-updating
        // schedule until reload.
        //
        // `sendMessage` only queues while readyState === CONNECTING; with
        // `ws.current === null` it falls through to
        // `console.error("WebSocket is closed. Cannot send message.")` and
        // drops the frame.
        expect(
            registerSyncFrames(socket).map((f) => f.syncObjectId),
            "REGISTER_SYNC_PROVIDER was neither queued nor sent: it was discarded while ws.current was null",
        ).toContain(iterationSyncId("iter-1"));
    });
});
