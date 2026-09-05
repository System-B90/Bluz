/*
 * Connection config, HMAC tickets, and the server core now live in
 * @system-b90/session-ws; this module remains the app-side import path
 * (barrelled through `@/settings`) and keeps Bluz's wire vocabulary.
 */
import { CoreMessageTypes } from "@system-b90/session-ws/protocol";

export {
    getWsAuthKey,
    NEXT_PUBLIC_WEBSOCKET_SESSION_SERVER_CONN_STRING,
    SECURE_CONTEXT_ONLY,
    signWsTicket,
    verifyWsTicket,
    WEBSOCKET_PORT_SUFFIX,
    WEBSOCKET_PROTOCOL,
    WEBSOCKET_SESSION_SERVER_HOST,
    WEBSOCKET_SESSION_SERVER_PORT,
    WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC,
} from "@system-b90/session-ws";

/**
 * Bluz's complete wire vocabulary. The first four values mirror
 * CoreMessageTypes from @system-b90/session-ws (handled by the server core);
 * the rest are Bluz-specific broadcast types.
 *
 * A TypeScript enum cannot extend another, so the core four are re-declared
 * here — but the assertion below makes a silent divergence a compile error
 * rather than a wire mismatch discovered at runtime (#540 item 8).
 */
export enum MessageTypes {
    REGISTER_SESSION = "register-session",
    REGISTER_SYNC_PROVIDER = "register-sync-provider",
    SYNC_OBJECT_UPDATE = "sync-object-update",
    DEREGISTER_SYNC_PROVIDER = "deregister-sync-provider",
    EVENT_DATA_UPDATE = "edu",
    EVENT_ADDED_OR_REMOVED = "ear",

    SETTINGS_UPDATE = "su",
    COURSES_UPDATE = "cu",
    ROOMS_UPDATE = "ru",
    OUTSIDERS_UPDATE = "ou",
    CUSTOM_COLORS_UPDATE = "ccu",

    /**
     * The current iteration changed (Settings → Iterations → "make current").
     * Every per-iteration collection provider resolves its data against
     * whichever iteration is current *at request time*, so a switch invalidates
     * every already-mounted provider at once (#663). Deliberately unscoped: the
     * clients that need to hear it are exactly the ones still pointed at the
     * iteration that just stopped being current.
     */
    CURRENT_ITERATION_CHANGED = "cic",

    // Period locking: broadcast that a user has started/finished editing an event
    EVENT_LOCK = "el",
    EVENT_UNLOCK = "eu",
}
/**
 * Compile-time proof that the mirrored values still match the package's.
 * If the core renames one, this stops building.
 */
const _coreMessageTypesMatch: {
    [K in keyof typeof CoreMessageTypes]: `${(typeof CoreMessageTypes)[K]}`;
} = {
    DEREGISTER_SYNC_PROVIDER: MessageTypes.DEREGISTER_SYNC_PROVIDER,
    REGISTER_SESSION: MessageTypes.REGISTER_SESSION,
    REGISTER_SYNC_PROVIDER: MessageTypes.REGISTER_SYNC_PROVIDER,
    SYNC_OBJECT_UPDATE: MessageTypes.SYNC_OBJECT_UPDATE,
};
void _coreMessageTypesMatch;

export const COMBO_DATA_KEY = "combo-data";

/**
 * Sync-object id for iteration-scoped calendar broadcasts (#525). Event
 * payloads carry a full `DbEventDocument`, not an id — fanning them out to
 * every logged-in browser regardless of which iteration it's viewing means
 * every user's wire receives every curriculum's complete event data. Clients
 * register as a sync-object listener for the iteration they're viewing
 * (`undefined` iterationId means "the current run"), and the server passes
 * the same id as `targets` on iteration-scoped broadcasts, so
 * `dispatchToSyncObjectListeners` only reaches sockets actually viewing that
 * iteration.
 */
export const CURRENT_ITERATION_SYNC_ID = "iteration:current";

export function iterationSyncId(iterationId?: string): string {
    return iterationId ? `iteration:${iterationId}` : CURRENT_ITERATION_SYNC_ID;
}
