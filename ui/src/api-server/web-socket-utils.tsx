import { WebSocket } from "ws";

import
{
    MessageTypes,
    WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY,
    WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC
} from "@/settings";

const INTERNAL_SESSION_SERVER_URI = "ws://bluz-sessions:28199/";

/**
 * Dispatch an asynchronous server-to-server request over WebSocket to the Session Server.
 * This runs within Next.js server-side API routes to broadcast event changes, additions,
 * or deletions to all connected clients in real-time.
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
)
{
    const ws = new WebSocket(INTERNAL_SESSION_SERVER_URI);
    ws.onopen = () =>
    {
        ws.send(
            JSON.stringify({
                sender: WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC,
                authKey: WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY,
                type: type,
                data,
            }),
        );
        // Cleanly close the socket after sending
        ws.close();
    };
    ws.onerror = (err) =>
    {
        console.error(
            "[WS Server Sender] Error dispatching message to session server:",
            err,
        );
    };
}
