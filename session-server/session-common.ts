/*
 * Connection config, HMAC tickets, and the server core now live in
 * @system-b15/session-ws; this module remains the app-side import path
 * (barrelled through `@/settings`) and keeps Bluz's wire vocabulary.
 */
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
} from "@system-b15/session-ws";

/**
 * Bluz's complete wire vocabulary. The first four values mirror
 * CoreMessageTypes from @system-b15/session-ws (handled by the server core);
 * the rest are Bluz-specific broadcast types.
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

    // Period locking: broadcast that a user has started/finished editing an event
    EVENT_LOCK = "el",
    EVENT_UNLOCK = "eu",
}
export const COMBO_DATA_KEY = "combo-data";
