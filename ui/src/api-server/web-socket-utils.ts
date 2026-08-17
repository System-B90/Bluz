import { WebSocket } from "ws";

import {
    getWsAuthKey,
    MessageTypes,
    signWsTicket,
    WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC,
} from "@/settings";

const INTERNAL_SESSION_SERVER_URI =
    process.env.INTERNAL_SESSION_SERVER_URI ?? "ws://bluz-sessions:28199/";

const CONNECT_TIMEOUT_MS = 5000;
const MAX_PENDING_MESSAGES = 1000;

// One persistent socket per process instead of a fresh TCP+WebSocket handshake
// per broadcast. Messages sent while (re)connecting are queued and flushed on
// open; if the connection drops, the next send lazily reconnects.
let socket: null | WebSocket = null;
const pendingMessages: Array<string> = [];

function flushPending(ws: WebSocket) {
    while (pendingMessages.length > 0) {
        const message = pendingMessages.shift()!;
        try {
            ws.send(message);
        } catch (error) {
            console.error("[WS Server Sender] Failed to flush message:", error);
        }
    }
}

function connect(): WebSocket {
    // The session server rejects any unticketed connection with 1008, which
    // silently killed every server→client broadcast. Signed per connect
    // attempt, not once at module load, because tickets expire and this
    // reconnects for the life of the process.
    const url = new URL(INTERNAL_SESSION_SERVER_URI);
    url.searchParams.set(
        "ticket",
        signWsTicket(WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC),
    );
    const ws = new WebSocket(url.toString());

    const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
            console.error(
                "[WS Server Sender] Timeout connecting to session server",
            );
            ws.terminate();
        }
    }, CONNECT_TIMEOUT_MS);
    // Never keep the process alive just for the broadcast channel.
    timeout.unref?.();

    ws.onopen = () => {
        clearTimeout(timeout);
        flushPending(ws);
    };

    ws.onerror = (err) => {
        console.error(
            `[WS Server Sender] Session server connection error: ${err.message}`,
        );
    };

    ws.onclose = () => {
        clearTimeout(timeout);
        if (socket === ws) {
            socket = null; // Next send re-establishes the connection.
        }
    };

    return ws;
}

/**
 * Dispatch an asynchronous server-to-server request over WebSocket to the Session Server.
 * This runs within Next.js server-side API routes to broadcast event changes, additions,
 * or deletions to all connected clients in real-time.
 *
 * The underlying connection is persistent and re-established lazily, so a broadcast
 * costs one `send()` on the hot path instead of a full connection handshake.
 *
 * @param type The type of message being broadcasted (e.g. MessageTypes.EVENT_DATA_UPDATE).
 * @param data Optional payload containing details of the updated/added/removed entities.
 * @example
 * ```typescript
 * SendServerRequestToSessionServer(MessageTypes.EVENT_ADDED_OR_REMOVED, {
 *   action: "added",
 *   newData: fixedEvent,
 *   eventId: eventId,
 * });
 * ```
 */
export function SendServerRequestToSessionServer(
    type: MessageTypes,
    data?: any,
) {
    const message = JSON.stringify({
        sender: WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC,
        authKey: getWsAuthKey(),
        type: type,
        data,
    });

    if (socket && socket.readyState === WebSocket.OPEN) {
        try {
            socket.send(message);
            return;
        } catch (error) {
            console.error(
                `[WS Server Sender] Send failed for "${type}", reconnecting:`,
                error,
            );
            socket = null;
        }
    }

    if (pendingMessages.length >= MAX_PENDING_MESSAGES) {
        // Broadcasts are fire-and-forget freshness hints; dropping the oldest
        // beats unbounded memory growth while the session server is down.
        pendingMessages.shift();
    }
    pendingMessages.push(message);

    // CLOSING counts as gone: the socket will never carry another frame, and
    // treating it as live parks every queued broadcast until something else
    // happens to trigger a reconnect.
    if (
        !socket ||
        socket.readyState === WebSocket.CLOSED ||
        socket.readyState === WebSocket.CLOSING
    ) {
        socket = connect();
    }
}
