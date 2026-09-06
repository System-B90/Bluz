import { WebSocket } from "ws";

import { logger } from "@/logging/pino";
import {
    getWsAuthKey,
    MessageTypes,
    signWsTicket,
    WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC,
} from "@/settings";

// The compose *service* name, not the container name. Compose gives every
// service a network alias matching its key, which resolves in every project;
// `container_name` does not survive a project rename. docker-compose.test.yml
// renames this container to ${TEST_PROJECT_NAME}-sessions, so the old
// "bluz-sessions" default failed to resolve in the e2e stack with
// "getaddrinfo ENOTFOUND bluz-sessions" — and since a failed broadcast only
// logs, every e2e run (CI included) passed with the server→client broadcast
// path silently dead. nginx.conf.test already addressed it as `sessions:28199`.
//
// This is the server-to-server hop only. Browsers reach the session server over
// the public host instead (WEBSOCKET_SESSION_SERVER_HOST, resolved in
// ui/src/app/layout.tsx), which is unaffected by this and must stay that way —
// an internal Docker alias is not resolvable from a browser.
const INTERNAL_SESSION_SERVER_URI =
    process.env.INTERNAL_SESSION_SERVER_URI ?? "ws://sessions:28199/";

const CONNECT_TIMEOUT_MS = 5000;
const RECONNECT_BACKOFF_MS = 1000;
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
            logger.error({ err: error }, "[WS Server Sender] Failed to flush message:");
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
            logger.error(
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
        logger.error(
            `[WS Server Sender] Session server connection error: ${err.message}`,
        );
    };

    ws.onclose = () => {
        clearTimeout(timeout);
        if (socket !== ws) return;
        socket = null;
        // A message that arrives while this connection is still (re)establishing
        // gets queued in pendingMessages regardless of how that attempt turns
        // out. Without this, a connect that loses the race against
        // CONNECT_TIMEOUT_MS — plausible for the very first connect a process
        // makes, before anything has warmed up — stranded that message forever:
        // nothing retried until some *unrelated* later call happened to invoke
        // SendServerRequestToSessionServer again. A one-off write with no
        // follow-up broadcast (e.g. a single event save) never got a second
        // chance, and the peer it was meant for silently never saw it.
        if (pendingMessages.length > 0) {
            const retry = setTimeout(() => {
                if (!socket) socket = connect();
            }, RECONNECT_BACKOFF_MS);
            retry.unref?.();
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
 * @param targets Sync-object id(s) to scope delivery to (see `iterationSyncId`).
 * Omit only for data that every connected client should receive regardless of
 * which iteration it's viewing.
 * @example
 * ```typescript
 * SendServerRequestToSessionServer(
 *   MessageTypes.EVENT_ADDED_OR_REMOVED,
 *   { action: "added", newData: fixedEvent, eventId: eventId },
 *   iterationSyncId(iterationId),
 * );
 * ```
 */
export function SendServerRequestToSessionServer(
    type: MessageTypes,
    data?: any,
    // Sync-object id(s) to scope this broadcast to (#525). Omitted means the
    // unscoped everyone-fan-out — only appropriate for data that isn't
    // iteration-scoped (settings, courses, rooms, ...).
    targets?: Array<string> | string,
) {
    const message = JSON.stringify({
        sender: WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC,
        authKey: getWsAuthKey(),
        type: type,
        data,
        targets,
    });

    if (socket && socket.readyState === WebSocket.OPEN) {
        try {
            socket.send(message);
            return;
        } catch (error) {
            logger.error({ err: error }, `[WS Server Sender] Send failed for "${type}", reconnecting:`);
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
