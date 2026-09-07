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
 * Two-session live-update coverage (#582).
 *
 * #582 asks for a two-user, two-client broadcast spec: proof that an event
 * written by one client actually reaches another client's calendar over the
 * WebSocket, rather than each client only ever seeing its own writes. Until
 * now nothing asserted that at any layer — the e2e suite drives a single
 * browser, so a totally dead broadcast path passed the whole suite. That is
 * not hypothetical: it happened. #587 found every e2e run had been executing
 * with the server->client channel down (`getaddrinfo ENOTFOUND bluz-sessions`)
 * and the suite stayed green throughout, because broadcasts are
 * fire-and-forget and no route awaits them.
 *
 * These tests are hermetic: the REAL shared session-server core runs against
 * an in-memory fake `ws` transport, with two independent client sockets
 * standing in for two tabs/sessions. No port is bound, no container runs, no
 * clock is waited on, so this can catch a broken fan-out in unit-test time
 * instead of needing the full stack.
 *
 * The per-file fake transport mirrors ws-session-server.test.ts and
 * ws-sync-subscription.test.tsx, which is the convention in this directory.
 */

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

// Async factories: vi.mock is hoisted above the imports, so the fakes have to
// be pulled in lazily from inside the factory rather than referenced from
// module scope.
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

/* ------------------------------------------------------------------ */
/* Harness                                                             */
/* ------------------------------------------------------------------ */



/**
 * Opens one client session — a browser tab. Two calls with the same `asUser`
 * model the same person with the app open twice; different users model two
 * people. Either way each gets its own socket, its own ticket and its own
 * subscriptions, which is what the server actually keys on.
 */
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
    // Drop anything echoed during setup so assertions read only broadcasts.
    socket.sent = [];
    return socket;
}

/**
 * Drives the real server->client broadcast path, exactly as
 * `SendServerRequestToSessionServer` does from an API route: a frame carrying
 * the server sender magic plus the shared auth key, with `targets` naming the
 * iteration's sync object.
 */
function broadcastFromServer(
    wss: FakeWebSocketServer,
    type: MessageTypes,
    data: Record<string, unknown>,
    iterationId?: string,
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
            targets: iterationSyncId(iterationId),
        }),
    );
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("live event updates across two sessions (#582)", () => {
    it("delivers an event update written by one session to the other", async () => {
        const wss = await loadSessionServer();
        const tabA = openSession(wss, "user-a", "initiator-a");
        const tabB = openSession(wss, "user-b", "initiator-b");

        // User A saves an event; the API route broadcasts it.
        broadcastFromServer(wss, MessageTypes.EVENT_DATA_UPDATE, {
            events: { "event-1": { id: "event-1", name: "שיעור" } },
        });

        // The point of the whole realtime layer: B sees A's write without
        // reloading. A dead broadcast path passes every single-browser test,
        // so this is the assertion that would have caught #587.
        const updates = tabB.receivedOfType(MessageTypes.EVENT_DATA_UPDATE);
        expect(
            updates,
            "the second session received no EVENT_DATA_UPDATE for the iteration it is viewing",
        ).toHaveLength(1);
        expect(updates[0]!.data.events["event-1"].name).toBe("שיעור");

        // And the writer's own session is kept in step too.
        expect(tabA.receivedOfType(MessageTypes.EVENT_DATA_UPDATE)).toHaveLength(1);
    });

    it("delivers a deletion to the other session", async () => {
        const wss = await loadSessionServer();
        const tabA = openSession(wss, "user-a", "initiator-a");
        const tabB = openSession(wss, "user-b", "initiator-b");

        broadcastFromServer(wss, MessageTypes.EVENT_ADDED_OR_REMOVED, {
            action: "removed",
            eventId: "event-1",
        });

        // Deletions matter more than updates here: a missed delete leaves a
        // phantom event the other user can still open and re-save.
        for (const [ name, tab ] of [ [ "A", tabA ], [ "B", tabB ] ] as const) {
            const frames = tab.receivedOfType(MessageTypes.EVENT_ADDED_OR_REMOVED);
            expect(frames, `session ${name} missed the removal`).toHaveLength(1);
            expect(frames[0]!.data.eventId).toBe("event-1");
        }
    });

    it("does not leak an update to a session viewing another iteration", async () => {
        const wss = await loadSessionServer();
        const current = openSession(wss, "user-a", "initiator-a");
        const archived = openSession(wss, "user-b", "initiator-b", "2025b");

        broadcastFromServer(wss, MessageTypes.EVENT_DATA_UPDATE, {
            events: { "event-1": { id: "event-1" } },
        });

        expect(
            current.receivedOfType(MessageTypes.EVENT_DATA_UPDATE),
        ).toHaveLength(1);
        // This is the #525 scoping working: full event documents must not
        // reach browsers looking at a different iteration.
        expect(
            archived.receivedOfType(MessageTypes.EVENT_DATA_UPDATE),
            "an iteration-scoped broadcast reached a session viewing a different iteration",
        ).toHaveLength(0);
    });

    it("delivers two near-simultaneous updates for the same event in send order, even when they disagree", async () => {
        const wss = await loadSessionServer();
        const tabB = openSession(wss, "user-b", "initiator-b");

        // Two sessions race to save the same event; the server has no
        // ordering guarantee beyond "relay frames as they arrive", so if the
        // second save's write completes and broadcasts before the first
        // save's broadcast is sent, the client can receive the older edit
        // last and have it stick — the same silent-clobber risk as the write
        // path, but on the read side. This pins down what a client actually
        // receives: two frames, in the order they were sent, which is what a
        // "last message wins" client-side apply has to reason about.
        broadcastFromServer(wss, MessageTypes.EVENT_DATA_UPDATE, {
            events: { "event-1": { id: "event-1", name: "גרסה ראשונה" } },
        });
        broadcastFromServer(wss, MessageTypes.EVENT_DATA_UPDATE, {
            events: { "event-1": { id: "event-1", name: "גרסה שנייה" } },
        });

        const updates = tabB.receivedOfType(MessageTypes.EVENT_DATA_UPDATE);
        expect(updates).toHaveLength(2);
        expect(updates[0]!.data.events["event-1"].name).toBe("גרסה ראשונה");
        expect(updates[1]!.data.events["event-1"].name).toBe("גרסה שנייה");
    });

    it("gives each of one user's two tabs only the traffic for the iteration it is viewing", async () => {
        const wss = await loadSessionServer();
        // Same person, two tabs open on two different iterations at once —
        // e.g. reviewing an older iteration in one tab while planning the
        // current one in the other. Neither should see the other's events.
        const tabCurrent = openSession(wss, "user-a", "initiator-a-current");
        const tabOther = openSession(wss, "user-a", "initiator-a-other", "2025b");

        broadcastFromServer(wss, MessageTypes.EVENT_DATA_UPDATE, {
            events: { "event-current": { id: "event-current" } },
        });
        broadcastFromServer(
            wss,
            MessageTypes.EVENT_DATA_UPDATE,
            { events: { "event-other": { id: "event-other" } } },
            "2025b",
        );

        const currentUpdates = tabCurrent.receivedOfType(
            MessageTypes.EVENT_DATA_UPDATE,
        );
        expect(currentUpdates).toHaveLength(1);
        expect(currentUpdates[0]!.data.events["event-current"]).toBeDefined();

        const otherUpdates = tabOther.receivedOfType(
            MessageTypes.EVENT_DATA_UPDATE,
        );
        expect(otherUpdates).toHaveLength(1);
        expect(otherUpdates[0]!.data.events["event-other"]).toBeDefined();
    });

    it("keeps delivering to the remaining session after the other tab closes", async () => {
        const wss = await loadSessionServer();
        const tabA = openSession(wss, "user-a", "initiator-a");
        const tabB = openSession(wss, "user-a", "initiator-a-2");

        // One tab is closed. Subscriptions are per-socket, so tearing down A's
        // must not disturb B's — a shared-registry bug here would silence a
        // user simply because they closed a duplicate tab.
        tabA.close();

        broadcastFromServer(wss, MessageTypes.EVENT_DATA_UPDATE, {
            events: { "event-2": { id: "event-2" } },
        });

        expect(
            tabB.receivedOfType(MessageTypes.EVENT_DATA_UPDATE),
            "closing one tab stopped the other tab's updates",
        ).toHaveLength(1);
        expect(tabA.receivedOfType(MessageTypes.EVENT_DATA_UPDATE)).toHaveLength(0);
    });

    it("fans an update out to every one of several concurrent viewers, and only them", async () => {
        // All coverage elsewhere stops at two sockets. A registry bug that
        // drops, say, every listener past the second (an off-by-one, or a
        // structure that silently caps out) would pass every other test in
        // this file and only show up with a third viewer in the room.
        const wss = await loadSessionServer();
        const viewers = [ "user-a", "user-b", "user-c", "user-d" ].map(
            (user, i) => openSession(wss, user, `initiator-${i}`),
        );
        const differentIteration = openSession(
            wss,
            "user-e",
            "initiator-e",
            "2025b",
        );

        broadcastFromServer(wss, MessageTypes.EVENT_DATA_UPDATE, {
            events: { "event-3": { id: "event-3" } },
        });

        viewers.forEach((tab, i) => {
            expect(
                tab.receivedOfType(MessageTypes.EVENT_DATA_UPDATE),
                `viewer ${i} of ${viewers.length} missed the broadcast`,
            ).toHaveLength(1);
        });
        expect(
            differentIteration.receivedOfType(MessageTypes.EVENT_DATA_UPDATE),
            "a broadcast for the current iteration leaked to a session viewing another one",
        ).toHaveLength(0);
    });

    it("delivers a move/resize (changed start and end time) to the other session", async () => {
        // `setDbEvent` broadcasts EVENT_DATA_UPDATE for every edit, including a
        // pure drag-to-reschedule that only changes startTime/endTime — there
        // is no separate "moved" message type. Every other EVENT_DATA_UPDATE
        // case in this file uses a minimal payload that doesn't distinguish a
        // real move from a no-op update; this pins that the full date fields
        // a drag actually changes round-trip through the relay untouched, in
        // the ISO-string shape `eventDateFixupToDate` produces server-side.
        const wss = await loadSessionServer();
        const tabA = openSession(wss, "user-a", "initiator-a");
        const tabB = openSession(wss, "user-b", "initiator-b");

        const moved = {
            id: "event-1",
            name: "שיעור",
            startTime: "2026-09-10T10:00:00.000Z",
            endTime: "2026-09-10T11:00:00.000Z",
        };
        broadcastFromServer(wss, MessageTypes.EVENT_DATA_UPDATE, {
            events: { "event-1": moved },
        });

        const [ frame ] = tabB.receivedOfType(MessageTypes.EVENT_DATA_UPDATE);
        expect(
            frame,
            "the second session never received the moved event",
        ).toBeDefined();
        expect(frame!.data.events["event-1"]).toEqual(moved);
    });
});
