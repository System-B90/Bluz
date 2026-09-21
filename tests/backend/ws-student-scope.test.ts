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
    STUDENT_SYNC_ID,
    WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC,
    WsScope,
} from "../../session-server/session-common";

/**
 * The WebSocket half of the student boundary (#656), run against the REAL
 * server core over the fake transport — the gates are configuration, and
 * configuration is exactly the kind of thing that looks right and behaves
 * wrong.
 *
 * A student socket is the first Bluz socket that is not staff. Two ways it
 * could reach staff data: registering a session (which puts it on the
 * untargeted fan-out, where `ws-unscoped-broadcasts.test.ts` shows course,
 * room, outsider and settings payloads travel), or subscribing to an
 * iteration sync object (where whole event documents travel). Both are pinned
 * here, and both are exercised the way an attacker would — by sending the
 * frame directly, not by asking the client code to send it.
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

/** Connects a socket carrying a ticket at `scope`. */
function connect(
    wss: FakeWebSocketServer,
    userId: string,
    scope: WsScope,
): FakeWebSocket {
    const socket = new FakeWebSocket();
    wss.emit("connection", socket, {
        url: `/?ticket=${encodeURIComponent(signWsTicket(userId, scope))}`,
    });
    return socket;
}

/** Connects a socket presenting an explicit, already-minted ticket. */
function connectWithTicket(
    wss: FakeWebSocketServer,
    ticket: string,
): FakeWebSocket {
    const socket = new FakeWebSocket();
    wss.emit("connection", socket, {
        url: `/?ticket=${encodeURIComponent(ticket)}`,
    });
    return socket;
}

/** Sends a raw client frame, exactly as a hostile browser would. */
function send(socket: FakeWebSocket, frame: Record<string, unknown>) {
    socket.emit("message", JSON.stringify(frame));
}

/** Server→relay broadcast, with or without `targets`. */
function broadcastFromServer(
    wss: FakeWebSocketServer,
    type: MessageTypes,
    data: Record<string, unknown> | undefined,
    targets?: string,
) {
    const sender = new FakeWebSocket();
    wss.emit("connection", sender, {
        url: `/?ticket=${encodeURIComponent(
            signWsTicket(WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC),
        )}`,
    });
    send(sender, {
        authKey: getWsAuthKey(),
        data,
        sender: WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC,
        targets,
        type,
    });
}

/** Message types a socket actually received. */
function received(socket: FakeWebSocket): Array<string> {
    return socket.sent.map((raw) => JSON.parse(raw).type);
}

describe("a student socket cannot join the untargeted fan-out", () => {
    it("is denied register-session even when it sends the frame itself", async () => {
        const wss = await loadSessionServer();
        const student = connect(wss, "student-1", WsScope.Hanich);
        const staff = connect(wss, "staff-1", WsScope.Segel);

        // Both ask, directly on the wire.
        send(student, {
            initiatorKey: "student-key",
            type: MessageTypes.REGISTER_SESSION,
        });
        send(staff, {
            initiatorKey: "staff-key",
            type: MessageTypes.REGISTER_SESSION,
        });
        student.sent = [];
        staff.sent = [];

        broadcastFromServer(wss, MessageTypes.COURSES_UPDATE, {
            courses: { c1: { id: "c1", instructorIds: [7], name: "מחזור א" } },
        });

        expect(received(staff)).toEqual([MessageTypes.COURSES_UPDATE]);
        expect(student.sent).toEqual([]);
    });

    it.each([
        MessageTypes.SETTINGS_UPDATE,
        MessageTypes.COURSES_UPDATE,
        MessageTypes.ROOMS_UPDATE,
        MessageTypes.OUTSIDERS_UPDATE,
        MessageTypes.CUSTOM_COLORS_UPDATE,
    ])("never receives %s", async (type) => {
        const wss = await loadSessionServer();
        const student = connect(wss, "student-1", WsScope.Hanich);
        send(student, {
            initiatorKey: "k",
            type: MessageTypes.REGISTER_SESSION,
        });
        student.sent = [];

        broadcastFromServer(wss, type, { secret: true });

        expect(student.sent).toEqual([]);
    });
});

describe("a student socket cannot subscribe to calendar traffic", () => {
    it("is denied the current-iteration sync object", async () => {
        const wss = await loadSessionServer();
        const student = connect(wss, "student-1", WsScope.Hanich);

        send(student, {
            syncObjectId: iterationSyncId(),
            type: MessageTypes.REGISTER_SYNC_PROVIDER,
        });
        student.sent = [];

        broadcastFromServer(
            wss,
            MessageTypes.EVENT_DATA_UPDATE,
            { events: { e1: { hidden: true, name: "סודי", notes: "פנימי" } } },
            iterationSyncId(),
        );

        expect(student.sent).toEqual([]);
    });

    it("is denied a named iteration, so iterations stay unreachable", async () => {
        const wss = await loadSessionServer();
        const student = connect(wss, "student-1", WsScope.Hanich);

        send(student, {
            syncObjectId: iterationSyncId("2025b"),
            type: MessageTypes.REGISTER_SYNC_PROVIDER,
        });
        student.sent = [];

        broadcastFromServer(
            wss,
            MessageTypes.EVENT_DATA_UPDATE,
            { events: { e1: { name: "סודי" } } },
            iterationSyncId("2025b"),
        );

        expect(student.sent).toEqual([]);
    });

    it("receives the student refresh ping it is allowed", async () => {
        const wss = await loadSessionServer();
        const student = connect(wss, "student-1", WsScope.Hanich);

        send(student, {
            syncObjectId: STUDENT_SYNC_ID,
            type: MessageTypes.REGISTER_SYNC_PROVIDER,
        });
        student.sent = [];

        broadcastFromServer(
            wss,
            MessageTypes.STUDENT_REFRESH,
            undefined,
            STUDENT_SYNC_ID,
        );

        expect(received(student)).toEqual([MessageTypes.STUDENT_REFRESH]);
    });

    it("gets a ping carrying no calendar data at all", async () => {
        const wss = await loadSessionServer();
        const student = connect(wss, "student-1", WsScope.Hanich);
        send(student, {
            syncObjectId: STUDENT_SYNC_ID,
            type: MessageTypes.REGISTER_SYNC_PROVIDER,
        });
        student.sent = [];

        broadcastFromServer(
            wss,
            MessageTypes.STUDENT_REFRESH,
            undefined,
            STUDENT_SYNC_ID,
        );

        const frame = JSON.parse(student.sent[0]);
        expect(frame.data ?? null).toBeNull();
    });

    it("gets no payload even when a broadcast tries to carry one", async () => {
        const wss = await loadSessionServer();
        const student = connect(wss, "student-1", WsScope.Hanich);
        send(student, {
            syncObjectId: STUDENT_SYNC_ID,
            type: MessageTypes.REGISTER_SYNC_PROVIDER,
        });
        student.sent = [];

        // The regression this guards: a caller that passes real event data
        // alongside the student target. `NotifyStudentsOfCalendarChange` never
        // does, but nothing about the call signature stops the next one, and a
        // leak here would look exactly like a working broadcast. The channel is
        // declared payload-free, so the server core strips it on the wire.
        broadcastFromServer(
            wss,
            MessageTypes.STUDENT_REFRESH,
            { events: { e1: { name: "סודי" } } },
            STUDENT_SYNC_ID,
        );

        const frame = JSON.parse(student.sent[0]);
        expect(frame.type).toBe(MessageTypes.STUDENT_REFRESH);
        expect(frame.data ?? null).toBeNull();
        expect(student.sent[0]).not.toContain("סודי");
    });

    it("refuses a replayed ticket, so an observed one opens no second socket", async () => {
        const wss = await loadSessionServer();
        const ticket = signWsTicket("staff-1", WsScope.Segel);

        const first = connectWithTicket(wss, ticket);
        expect(first.closedWith).toEqual([]);

        // Same ticket, presented again inside its TTL: a staff socket is the
        // whole calendar wire, so a replay must not get one.
        const replay = connectWithTicket(wss, ticket);
        expect(replay.closedWith[0][0]).toBe(1008);
    });
});

describe("a student socket cannot forge staff presence", () => {
    it("its lock frame is dropped instead of relayed", async () => {
        const wss = await loadSessionServer();
        const staff = connect(wss, "staff-1", WsScope.Segel);
        send(staff, { initiatorKey: "staff", type: MessageTypes.REGISTER_SESSION });
        send(staff, {
            syncObjectId: iterationSyncId(),
            type: MessageTypes.REGISTER_SYNC_PROVIDER,
        });
        const student = connect(wss, "student-1", WsScope.Hanich);
        staff.sent = [];

        send(student, {
            data: { eventId: "e1", iterationId: undefined },
            type: MessageTypes.EVENT_LOCK,
        });

        expect(staff.sent).toEqual([]);
    });
});

describe("staff sockets keep their existing access", () => {
    it("still registers a session and receives untargeted broadcasts", async () => {
        const wss = await loadSessionServer();
        const staff = connect(wss, "staff-1", WsScope.Segel);
        send(staff, { initiatorKey: "k", type: MessageTypes.REGISTER_SESSION });
        staff.sent = [];

        broadcastFromServer(wss, MessageTypes.ROOMS_UPDATE, { rooms: {} });

        expect(received(staff)).toEqual([MessageTypes.ROOMS_UPDATE]);
    });

    it("still subscribes to an iteration and receives event payloads", async () => {
        const wss = await loadSessionServer();
        const staff = connect(wss, "staff-1", WsScope.Segel);
        send(staff, {
            syncObjectId: iterationSyncId("2025b"),
            type: MessageTypes.REGISTER_SYNC_PROVIDER,
        });
        staff.sent = [];

        broadcastFromServer(
            wss,
            MessageTypes.EVENT_DATA_UPDATE,
            { events: { e1: { name: "שיעור" } } },
            iterationSyncId("2025b"),
        );

        expect(received(staff)).toEqual([MessageTypes.EVENT_DATA_UPDATE]);
    });

    it("still relays a staff lock frame", async () => {
        const wss = await loadSessionServer();
        const staff = connect(wss, "staff-1", WsScope.Segel);
        send(staff, {
            syncObjectId: iterationSyncId(),
            type: MessageTypes.REGISTER_SYNC_PROVIDER,
        });
        const other = connect(wss, "staff-2", WsScope.Segel);
        send(other, {
            syncObjectId: iterationSyncId(),
            type: MessageTypes.REGISTER_SYNC_PROVIDER,
        });
        other.sent = [];

        send(staff, {
            data: { eventId: "e1" },
            type: MessageTypes.EVENT_LOCK,
        });

        expect(received(other)).toEqual([MessageTypes.EVENT_LOCK]);
    });

    it("the internal server sender keeps working on its unscoped ticket", async () => {
        const wss = await loadSessionServer();
        const staff = connect(wss, "staff-1", WsScope.Segel);
        send(staff, { initiatorKey: "k", type: MessageTypes.REGISTER_SESSION });
        staff.sent = [];

        // Signed with no scope at all — the shape `web-socket-utils` uses.
        broadcastFromServer(wss, MessageTypes.SETTINGS_UPDATE, {});

        expect(received(staff)).toEqual([MessageTypes.SETTINGS_UPDATE]);
    });
});
