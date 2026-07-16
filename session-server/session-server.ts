/*
 * Thin entry over the shared server core (@system-b90/session-ws/server):
 * ticket-authenticated connects, session/sync registries, heartbeat, and
 * graceful shutdown live in the package; Bluz plugs in its lock-relay types.
 */
import { startSessionServer } from "@system-b90/session-ws/server";

import { MessageTypes } from "./session-common";

const server = startSessionServer({
    validMessageTypes: Object.values(MessageTypes),
    onClientMessage: (ws, data, dispatch) => {
        switch (data["type"]) {
            // Period locking: relay ephemeral lock/unlock presence from one
            // client to all connected clients. Not persisted — pure presence
            // signalling. The sender receives its own lock back and filters
            // it out client-side.
            case MessageTypes.EVENT_LOCK:
            case MessageTypes.EVENT_UNLOCK:
                dispatch.dispatchMessageToEveryone(
                    data["type"],
                    undefined,
                    data["data"] as Record<string, unknown> | undefined,
                );
                return true;
        }
        return false;
    },
});

export default server.wss;
