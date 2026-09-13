/*
 * Thin entry over the shared server core (@system-b90/session-ws/server):
 * ticket-authenticated connects, session/sync registries, heartbeat, and
 * graceful shutdown live in the package; Bluz plugs in its lock-relay types.
 */
import { startSessionServer } from "@system-b90/session-ws/server";

import {
    iterationSyncId,
    MessageTypes,
    STUDENT_SYNC_ID,
    WsScope,
} from "./session-common";

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
    /*
     * The student channel carries pings and nothing else — enforced on the
     * wire rather than trusted to every call site. `NotifyStudentsOfCalendarChange`
     * is careful today, but it is one `targets` argument away from shipping a
     * DbEventDocument to every student socket, and that mistake would look
     * exactly like a working broadcast. The core strips `data` from anything
     * aimed here, so the projection endpoint stays the only way a student
     * learns what changed.
     */
    payloadFreeSyncObjects: [STUDENT_SYNC_ID],
    /*
     * Assume the ticket is observed. It is short-lived, but within its TTL a
     * replay opens a second socket carrying the victim's *scope* — which for a
     * staff ticket is the whole calendar wire. Both Bluz clients mint a ticket
     * per connect attempt (the React hook fetches /api/ws-ticket on every
     * connect, and the server-sender signs one per reconnect), so nothing here
     * reuses one.
     */
    singleUseTickets: true,
    /*
     * Students hold real sessions as of #656, so a ticketed connection is no
     * longer proof of staff clearance. A registered session receives every
     * *untargeted* broadcast — COURSES_UPDATE, OUTSIDERS_UPDATE and friends
     * carry real payloads — so a Hanich socket must not become one. It listens
     * to STUDENT_SYNC_ID and receives nothing but empty pings.
     */
    canRegisterSession: ({ scope }) => scope !== WsScope.Hanich,
    canListenToSyncObject: ({ scope }, syncObjectId) => {
        // The only sync object a student may hold, and the reason iterations
        // stay invisible to them: there is no per-iteration student channel.
        if (scope === WsScope.Hanich) return syncObjectId === STUDENT_SYNC_ID;
        // Staff: any staff user can already view any iteration through the
        // regular API — a subscription just narrows which *broadcasts* a
        // socket receives, it grants no new read access (#525).
        return true;
    },
    onClientMessage: (ws, data, dispatch, identity) => {
        // Students only ever listen. Every app-level frame here is a staff
        // presence relay, and a student must not be able to forge one.
        if (identity.scope === WsScope.Hanich) {
            return true;
        }

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
                const iterationId = (payload as Record<string, unknown>)[
                    "iterationId"
                ];
                dispatch.dispatchMessageToEveryone(
                    data["type"],
                    iterationSyncId(
                        typeof iterationId === "string" ? iterationId : undefined,
                    ),
                    {
                        ...(payload as Record<string, unknown>),
                        // Identity comes from the connect ticket, never from
                        // the frame: a client could otherwise claim any
                        // lockedById and show a forged "X is editing" badge
                        // to everyone (#540.2).
                        lockedById: identity.userId,
                    },
                );
                return true;
            }
        }
        return false;
    },
});

export default server.wss;
