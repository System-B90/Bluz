import { WebSocket, WebSocketServer } from "ws";
import {
    MessageTypes,
    WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY,
    WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC,
} from "./session-common";

const LISTEN_PORT = Number.parseInt(
    process.env.WEBSOCKET_SESSION_SERVER_INTERNAL_PORT ?? "28199",
    10,
);
const HEARTBEAT_INTERVAL_MS = Number.parseInt(
    process.env.WEBSOCKET_SESSION_SERVER_HEARTBEAT_MS ?? "30000",
    10,
);

type MessageData = Record<string, unknown>;

interface SessionState {
    initiatorKey?: string;
    isAlive: boolean;
    /** Sync-object ids this socket listens to (for O(1) cleanup on close). */
    syncObjectIds: Set<string>;
}

/**
 * In-memory connection registry.
 *
 * Every accepted socket gets a SessionState; `sessions` drives the broadcast
 * fan-out and the heartbeat sweep. `syncObjectListeners` is a reverse index
 * (sync-object id → listening sockets) so targeted dispatch never scans the
 * whole session table.
 *
 * NOTE: the registry is process-local. To scale this server horizontally the
 * fan-out must go through a shared broker (e.g. Redis pub/sub) — see
 * docs/performance-and-scaling.md.
 */
const sessions = new Map<WebSocket, SessionState>();
const syncObjectListeners = new Map<string, Set<WebSocket>>();

function log(message: string) {
    console.log(`[WS] ${message}`);
}

function logError(message: string, error?: unknown) {
    console.error(`[WS] ${message}`, error ?? "");
}

function registerSession(ws: WebSocket, initiatorKey: unknown) {
    if (typeof initiatorKey !== "string") {
        logError(
            `register-session ignored: initiatorKey must be a string, got ${typeof initiatorKey}`,
        );
        return;
    }
    const state = sessions.get(ws);
    if (state) {
        state.initiatorKey = initiatorKey;
    }
}

function registerSyncObjectListener(ws: WebSocket, syncObjectId: unknown) {
    if (typeof syncObjectId !== "string") {
        logError(
            `register-sync-provider ignored: syncObjectId must be a string, got ${typeof syncObjectId}`,
        );
        return;
    }
    let listeners = syncObjectListeners.get(syncObjectId);
    if (!listeners) {
        listeners = new Set();
        syncObjectListeners.set(syncObjectId, listeners);
    }
    listeners.add(ws);
    sessions.get(ws)?.syncObjectIds.add(syncObjectId);
}

function removeConnection(ws: WebSocket) {
    const state = sessions.get(ws);
    if (!state) return;

    for (const syncObjectId of state.syncObjectIds) {
        const listeners = syncObjectListeners.get(syncObjectId);
        if (!listeners) continue;
        listeners.delete(ws);
        if (listeners.size === 0) {
            syncObjectListeners.delete(syncObjectId);
        }
    }
    sessions.delete(ws);
    if (state.initiatorKey) {
        log(`Session ${state.initiatorKey} removed`);
    }
}

function buildMessage(
    messageType: MessageTypes,
    target?: string,
    data?: MessageData,
): string {
    return JSON.stringify({ type: messageType, target, data });
}

function safeSend(ws: WebSocket, message: string, context: string) {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
        ws.send(message);
    } catch (error) {
        logError(`Failed to send ${context}`, error);
    }
}

function dispatchMessageToEveryone(
    messageType: MessageTypes,
    targets?: Array<string> | string,
    data?: MessageData,
) {
    // Serialize once per broadcast instead of once per recipient.
    const message = buildMessage(messageType, undefined, data);
    for (const [ws, state] of sessions) {
        if (state.initiatorKey === undefined) continue;
        safeSend(ws, message, `${messageType} to ${state.initiatorKey}`);
    }

    if (typeof targets === "string") {
        dispatchToSyncObjectListeners(messageType, targets, data);
    } else if (Array.isArray(targets)) {
        for (const target of targets) {
            dispatchToSyncObjectListeners(messageType, target, data);
        }
    }
}

function dispatchToSyncObjectListeners(
    messageType: MessageTypes,
    syncObjectId: string,
    data?: MessageData,
) {
    const listeners = syncObjectListeners.get(syncObjectId);
    if (!listeners || listeners.size === 0) {
        log(`Dispatch requested on sync object "${syncObjectId}" with no listeners`);
        return;
    }
    const message = buildMessage(messageType, syncObjectId, data);
    for (const ws of listeners) {
        safeSend(ws, message, `${messageType} to sync object ${syncObjectId}`);
    }
}

function validateServerMessage(data: MessageData) {
    if (!("authKey" in data)) {
        throw new Error(`Missing "authKey" in server data!`);
    }
    if (data["authKey"] !== WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY) {
        throw new Error(`Invalid "authKey" in server data!`);
    }
}

function handleServerMessage(data: MessageData) {
    try {
        validateServerMessage(data);
        log(`Server message ${data["type"]}`);
        delete data["authKey"];
        dispatchMessageToEveryone(
            data["type"] as MessageTypes,
            data["targets"] as Array<string> | string | undefined,
            data["data"] as MessageData | undefined,
        );
    } catch (error) {
        logError("Server message error", error);
    }
}

const VALID_MESSAGE_TYPES = new Set<unknown>(Object.values(MessageTypes));

function handleClientMessage(ws: WebSocket, data: MessageData) {
    switch (data["type"]) {
        case MessageTypes.REGISTER_SESSION:
            registerSession(ws, data["initiatorKey"]);
            break;
        case MessageTypes.REGISTER_SYNC_PROVIDER:
            registerSyncObjectListener(ws, data["syncObjectId"]);
            break;
        // Period locking: relay ephemeral lock/unlock presence from one client
        // to all connected clients. Not persisted — pure presence signalling.
        // The sender receives its own lock back and filters it out client-side.
        case MessageTypes.EVENT_LOCK:
        case MessageTypes.EVENT_UNLOCK:
            dispatchMessageToEveryone(
                data["type"] as MessageTypes,
                undefined,
                data["data"] as MessageData | undefined,
            );
            break;
    }
}

const wss = new WebSocketServer({
    port: LISTEN_PORT,
    perMessageDeflate: {
        zlibDeflateOptions: {
            chunkSize: 1024,
            memLevel: 7,
            level: 3,
        },
        zlibInflateOptions: {
            chunkSize: 10 * 1024,
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 50, // Limits zlib concurrency for perf.
        threshold: 1024, // Don't compress payloads smaller than this.
    },
});

wss.on("listening", () => log(`Listening on port ${LISTEN_PORT}`));

wss.on("connection", (ws) => {
    sessions.set(ws, { isAlive: true, syncObjectIds: new Set() });

    ws.on("pong", () => {
        const state = sessions.get(ws);
        if (state) state.isAlive = true;
    });

    ws.on("error", (error) => logError("Connection error", error));

    ws.on("close", () => removeConnection(ws));

    ws.on("message", (dataString) => {
        let data: MessageData;
        try {
            data = JSON.parse(dataString.toString());
        } catch {
            logError("Received malformed frame, ignoring");
            return;
        }

        if (data["sender"] === WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC) {
            handleServerMessage(data);
            return;
        }
        if (!VALID_MESSAGE_TYPES.has(data["type"])) {
            logError(`Unknown message type "${data["type"]}", ignoring`);
            return;
        }
        handleClientMessage(ws, data);
    });
});

// Protocol-level heartbeat: browsers and the `ws` client answer pings
// automatically, so a socket that misses a full interval is genuinely dead
// (half-open TCP, crashed tab, dropped network) and gets terminated. This
// replaces the old mark-and-sweep GC, which purged idle-but-healthy sockets.
const heartbeat = setInterval(() => {
    for (const [ws, state] of sessions) {
        if (!state.isAlive) {
            log(
                `Terminating unresponsive session${state.initiatorKey ? ` ${state.initiatorKey}` : ""}`,
            );
            ws.terminate(); // "close" handler performs registry cleanup.
            continue;
        }
        state.isAlive = false;
        ws.ping();
    }
}, HEARTBEAT_INTERVAL_MS);

function shutdown(signal: string) {
    log(`${signal} received, shutting down`);
    clearInterval(heartbeat);
    for (const ws of sessions.keys()) {
        ws.close(1001, "Server shutting down");
    }
    wss.close(() => process.exit(0));
    // Force-exit if clients keep the server alive past the grace period.
    setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default wss;
