/*
 * The WS client hook now lives in @system-b15/session-ws/react; this module
 * remains the app-side import path and binds the generic hook to Bluz's
 * MessageTypes vocabulary.
 */
import {
    MessageHandlerType as SharedMessageHandlerType,
    useSessionWebSocketContext as useSharedSessionWebSocketContext,
} from "@system-b15/session-ws/react";

import { MessageTypes } from "@/settings";

export { useMessageHandler } from "@system-b15/session-ws/react";

/**
 * Handler callback for processing incoming WebSocket messages on the client.
 * @param messageType The type of WS message (from MessageTypes).
 * @param data The JSON data payload containing domain entities/changes.
 * @example
 * ```typescript
 * const onWebSocketMessage: MessageHandlerType = (type, data) => {
 *   if (type === MessageTypes.COURSES_UPDATE) {
 *     loadCourses();
 *   }
 * };
 * ```
 */
export type MessageHandlerType = SharedMessageHandlerType<MessageTypes>;

/**
 * Custom hook to establish and manage client-side WebSocket sessions.
 * Manages event listener registrations, session heartbeats, and auto-reconnection
 * with exponential backoff on close/error.
 */
export function useSessionWebSocketContext() {
    return useSharedSessionWebSocketContext<MessageTypes>();
}
