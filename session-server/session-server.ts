/*
 * Thin entry over the shared server core (@system-b90/session-ws/server):
 * ticket-authenticated connects, session/sync registries, heartbeat, and
 * graceful shutdown live in the package; Bluz plugs in its lock-relay types.
 */
import { startSessionServer } from "@system-b90/session-ws/server";

import { MessageTypes } from "./session-common";

/*
 * Crash guard (#511). The shared core reads frame fields without a shape
 * check, so a malformed frame (e.g. the literal text `null`) throws
 * synchronously inside the ws message handler. Without a guard that becomes
 * an uncaughtException, the process exits, and Docker's `restart:
 * unless-stopped` turns it into a repeatable kill-loop that disconnects every
 * browser. Log and keep serving instead. The shape check itself belongs in
 * @system-b90/session-ws; this is defence in depth for whatever gets past it.
 */
process.on("uncaughtException", (error) => {
    console.error("[session-server] uncaught exception, staying up:", error);
});
process.on("unhandledRejection", (reason) => {
    console.error("[session-server] unhandled rejection, staying up:", reason);
});

const server = startSessionServer({
    validMessageTypes: Object.values(MessageTypes),
    onClientMessage: (ws, data, dispatch, identity) => {
        // Frames are attacker-controlled; reject anything that is not a plain
        // object before touching its fields (#511).
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            return true;
        }
        switch (data["type"]) {
            // Period locking: relay ephemeral lock/unlock presence from one
            // client to all connected clients. Not persisted — pure presence
            // signalling. The sender receives its own lock back and filters
            // it out client-side.
            case MessageTypes.EVENT_LOCK:
            case MessageTypes.EVENT_UNLOCK: {
                const payload = data["data"];
                if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
                    return true;
                }
                dispatch.dispatchMessageToEveryone(data["type"], undefined, {
                    ...(payload as Record<string, unknown>),
                    // Identity comes from the connect ticket, never from the
                    // frame: a client could otherwise claim any lockedById and
                    // show a forged "X is editing" badge to everyone (#540.2).
                    lockedById: identity.userId,
                });
                return true;
            }
        }
        return false;
    },
});

export default server.wss;
