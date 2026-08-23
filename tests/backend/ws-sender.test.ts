import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    MessageTypes,
    verifyWsTicket,
    WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC,
} from "@/settings";

/**
 * Tests for the persistent server->session-server sender
 * (ui/src/api-server/web-socket-utils.ts).
 *
 * The `ws` module is replaced with an in-memory fake socket class and time is
 * frozen, so connect timeouts and ticket expiry windows are deterministic and
 * nothing ever touches the network. The sender keeps its singleton socket +
 * pending queue in module state, so every test re-imports the module through
 * vi.resetModules to start from a clean slate.
 */
const constructed: Array<FakeWebSocket> = [];

class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readonly url: string;
    readyState = FakeWebSocket.CONNECTING;
    sent: Array<string> = [];
    terminated = false;
    onopen: (() => void) | undefined;
    onerror: ((error: { message: string }) => void) | undefined;
    onclose: (() => void) | undefined;

    constructor(url: string) {
        this.url = url;
        constructed.push(this);
    }

    send(data: string) {
        this.sent.push(data);
    }

    terminate() {
        this.terminated = true;
        this.readyState = FakeWebSocket.CLOSED;
    }

    close() {
        this.readyState = FakeWebSocket.CLOSED;
    }

    /** Test-side trigger for the module's onopen handler. */
    open() {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.();
    }
}

vi.mock("ws", () => ({ WebSocket: FakeWebSocket }));

/**
 * The sender logs through pino (`@/logging/pino`), not `console`, since the
 * api-server logging standardisation. Assertions below target this mock.
 */
const { logger } = vi.hoisted(() => ({
    logger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock("@/logging/pino", () => ({ logger }));

const originalAuthKey = process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY;
const originalUri = process.env.INTERNAL_SESSION_SERVER_URI;

beforeEach(() => {
    process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY = "test-secret";
    process.env.INTERNAL_SESSION_SERVER_URI = "ws://sessions.internal:12345/ws/";
    constructed.length = 0;
    logger.debug.mockClear();
    logger.error.mockClear();
    logger.info.mockClear();
    logger.warn.mockClear();
    vi.useFakeTimers();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY = originalAuthKey;
    if (originalUri === undefined) {
        delete process.env.INTERNAL_SESSION_SERVER_URI;
    } else {
        process.env.INTERNAL_SESSION_SERVER_URI = originalUri;
    }
});

async function loadSender() {
    vi.resetModules();
    return await import("@/api-server/web-socket-utils");
}

function ticketExpiresAt(socketUrl: string) {
    const ticket = new URL(socketUrl).searchParams.get("ticket");
    expect(ticket).not.toBeNull();
    return Number(ticket!.split(".")[1]);
}

describe("SendServerRequestToSessionServer connection lifecycle", () => {
    it("opens one socket targeting INTERNAL_SESSION_SERVER_URI with a signed server ticket", async () => {
        const { SendServerRequestToSessionServer } = await loadSender();

        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE);

        expect(constructed).toHaveLength(1);
        const url = new URL(constructed[0].url);
        expect(url.origin).toBe("ws://sessions.internal:12345");
        expect(url.pathname).toBe("/ws/");
        // Unticketed connects are rejected by the session server with 1008,
        // which silently killed every server-to-client broadcast once.
        expect(
            verifyWsTicket(url.searchParams.get("ticket") ?? ""),
        ).toBe(WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC);
    });

    it("falls back to the docker-compose service URI when no URI is configured", async () => {
        delete process.env.INTERNAL_SESSION_SERVER_URI;
        const { SendServerRequestToSessionServer } = await loadSender();

        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE);

        expect(constructed[0].url.startsWith("ws://bluz-sessions:28199/")).toBe(
            true,
        );
    });

    it("signs a fresh ticket per connection attempt, not once at module load", async () => {
        const { SendServerRequestToSessionServer } = await loadSender();

        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE);
        const firstExpiry = ticketExpiresAt(constructed[0].url);

        // Ten seconds pass, the socket drops, and the next broadcast lazily
        // reconnects: the new ticket must be signed against the new clock,
        // because tickets expire after 30s and this socket lives for the
        // lifetime of the process.
        vi.advanceTimersByTime(10_000);
        constructed[0].onclose?.();
        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE);

        expect(constructed).toHaveLength(2);
        const secondExpiry = ticketExpiresAt(constructed[1].url);
        expect(secondExpiry - firstExpiry).toBe(10_000);
        expect(
            verifyWsTicket(new URL(constructed[1].url).searchParams.get("ticket") ?? ""),
        ).toBe(WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC);
    });

    it("terminates the socket when the handshake exceeds the connect timeout", async () => {
        const { SendServerRequestToSessionServer } = await loadSender();

        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE);
        vi.advanceTimersByTime(4999);
        expect(constructed[0].terminated).toBe(false);
        vi.advanceTimersByTime(1);

        expect(constructed[0].terminated).toBe(true);
    });

    it("does not terminate a socket that opened in time", async () => {
        const { SendServerRequestToSessionServer } = await loadSender();

        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE);
        constructed[0].open();
        vi.advanceTimersByTime(60_000);

        expect(constructed[0].terminated).toBe(false);
        expect(logger.error).not.toHaveBeenCalled();
    });

    it("clears the socket on close lazily and reconnects on the next send", async () => {
        const { SendServerRequestToSessionServer } = await loadSender();

        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE);
        constructed[0].open();

        // Close must not eagerly dial: the reconnect is lazy, paid by whoever
        // broadcasts next.
        constructed[0].onclose?.();
        expect(constructed).toHaveLength(1);

        SendServerRequestToSessionServer(MessageTypes.EVENT_ADDED_OR_REMOVED);
        expect(constructed).toHaveLength(2);
        constructed[1].open();

        expect(JSON.parse(constructed[1].sent[0]).type).toBe(
            MessageTypes.EVENT_ADDED_OR_REMOVED,
        );
    });

    it("treats a CLOSING socket as gone and opens a replacement", async () => {
        const { SendServerRequestToSessionServer } = await loadSender();

        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE);
        constructed[0].open();
        // The first broadcast was queued while connecting and flushed on open.
        expect(constructed[0].sent).toHaveLength(1);

        // A CLOSING socket will never carry another frame; treating it as
        // live parks every later broadcast until an unrelated reconnect.
        constructed[0].readyState = FakeWebSocket.CLOSING;
        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE, {
            eventId: "event-1",
        });

        expect(constructed).toHaveLength(2);
        expect(constructed[0].sent).toHaveLength(1);
        constructed[1].open();

        expect(JSON.parse(constructed[1].sent[0]).data).toEqual({
            eventId: "event-1",
        });
    });

    it("logs a connection error without dropping the healthy socket", async () => {
        const { SendServerRequestToSessionServer } = await loadSender();

        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE);
        constructed[0].open();
        constructed[0].onerror?.({ message: "transient hiccup" });

        // An error event alone is not a disconnect: only close resets the
        // slot, so the open socket keeps serving broadcasts directly.
        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE, {
            eventId: "event-1",
        });
        expect(constructed).toHaveLength(1);
        expect(JSON.parse(constructed[0].sent[1]).data).toEqual({
            eventId: "event-1",
        });
        expect(logger.error).toHaveBeenCalledOnce();
    });
});

describe("SendServerRequestToSessionServer outbound queue", () => {
    it("queues messages sent while connecting and flushes them oldest-first on open", async () => {
        const { SendServerRequestToSessionServer } = await loadSender();

        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE, {
            i: 1,
        });
        SendServerRequestToSessionServer(MessageTypes.EVENT_ADDED_OR_REMOVED, {
            i: 2,
        });

        // One CONNECTING socket serves both sends; nothing hits the wire yet.
        expect(constructed).toHaveLength(1);
        expect(constructed[0].sent).toHaveLength(0);

        constructed[0].open();

        expect(constructed[0].sent).toHaveLength(2);
        expect(JSON.parse(constructed[0].sent[0]).data).toEqual({ i: 1 });
        expect(JSON.parse(constructed[0].sent[1]).data).toEqual({ i: 2 });
    });

    it("sends directly over an open socket without going through the queue", async () => {
        const { SendServerRequestToSessionServer } = await loadSender();

        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE);
        constructed[0].open();
        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE, {
            eventId: "event-1",
        });

        expect(constructed).toHaveLength(1);
        // sent[0] is the initial broadcast flushed on open; this one bypassed
        // the queue entirely.
        expect(constructed[0].sent).toHaveLength(2);
        expect(JSON.parse(constructed[0].sent[1]).data).toEqual({
            eventId: "event-1",
        });
    });

    it("drops the oldest queued message beyond MAX_PENDING_MESSAGES (1000)", async () => {
        const { SendServerRequestToSessionServer } = await loadSender();

        for (let index = 0; index < 1002; index++) {
            SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE, {
                i: index,
            });
        }

        constructed[0].open();

        expect(constructed[0].sent).toHaveLength(1000);
        expect(JSON.parse(constructed[0].sent[0]).data).toEqual({ i: 2 });
        expect(JSON.parse(constructed[0].sent.at(-1)!).data).toEqual({
            i: 1001,
        });
    });

    it("falls back to the queue plus a reconnect when send() throws on an open socket", async () => {
        const { SendServerRequestToSessionServer } = await loadSender();

        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE);
        constructed[0].open();
        constructed[0].send = () => {
            throw new Error("EPIPE");
        };

        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE, {
            eventId: "event-1",
        });

        expect(logger.error).toHaveBeenCalledOnce();
        expect(constructed).toHaveLength(2);
        // sent[0] is the initial broadcast flushed on open; nothing else was
        // delivered over the broken socket.
        expect(constructed[0].sent).toHaveLength(1);

        constructed[1].open();
        expect(JSON.parse(constructed[1].sent[0]).data).toEqual({
            eventId: "event-1",
        });
    });
});

describe("SendServerRequestToSessionServer wire envelope", () => {
    it("frames carry the server magic, auth key, type, and data", async () => {
        const { SendServerRequestToSessionServer } = await loadSender();

        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE, {
            eventId: "event-1",
        });
        constructed[0].open();

        // The session server routes frames whose sender is the server magic
        // into its authenticated server-message path, so both fields are
        // load-bearing protocol, not decoration.
        expect(JSON.parse(constructed[0].sent[0])).toEqual({
            sender: WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC,
            authKey: "test-secret",
            type: MessageTypes.EVENT_DATA_UPDATE,
            data: { eventId: "event-1" },
        });
    });

    it("omits the data field entirely when no payload is given", async () => {
        const { SendServerRequestToSessionServer } = await loadSender();

        SendServerRequestToSessionServer(MessageTypes.COURSES_UPDATE);
        constructed[0].open();

        const frame = JSON.parse(constructed[0].sent[0]);
        expect(Object.hasOwn(frame, "data")).toBe(false);
    });
});
