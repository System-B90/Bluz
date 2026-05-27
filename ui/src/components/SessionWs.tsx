import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
} from "react";

import { useWebSocketConfig } from "@/components/WebsocketConfigProvider";
import { MessageTypes } from "@/settings";

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
export type MessageHandlerType = (messageType: MessageTypes, data: any) => void;
const MessageHandlerContext = createContext<MessageHandlerType>(() => {});

/**
 * Custom hook to establish and manage client-side WebSocket sessions.
 * Manages event listener registrations and session heartbeats.
 *
 * @returns An object containing the WebSocket ref and helper to add/remove handlers.
 * @example
 * ```typescript
 * const { ws, addMessageHandler } = useSessionWebSocketContext();
 * ```
 */
export function useSessionWebSocketContext() {
    const { connectionString } = useWebSocketConfig();

    const ws = useRef<null | WebSocket>(null);
    const messageHandlers = useRef<Array<MessageHandlerType>>([]);

    const addMessageHandler = useCallback((handler: MessageHandlerType) => {
        if (typeof window === "undefined") return () => {};

        messageHandlers.current.push(handler);

        return () => {
            messageHandlers.current = messageHandlers.current.filter(
                (h) => h !== handler,
            );
        };
    }, []);

    const webSocketMessageHandler = useCallback((ev: MessageEvent<any>) => {
        const parsed = JSON.parse(ev.data);
        const { type, data }: { type: MessageTypes; data: any } = parsed;
        console.log(`[WS] Message type: ${type}`);
        messageHandlers.current.forEach((handler) => handler(type, data));
    }, []);

    const registerCurrentSession = useCallback(() => {
        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;

        ws.current.send(
            JSON.stringify({
                type: MessageTypes.REGISTER_SESSION,
                initiatorKey: crypto.randomUUID(),
            }),
        );
    }, []);

    useEffect(() => {
        if (ws.current == null) {
            ws.current = new WebSocket(connectionString);
        }

        const socket = ws.current;

        socket.onclose = () => console.log("ws closed");
        socket.onmessage = webSocketMessageHandler;

        const handleOpen = () => {
            console.log("Connection is made");
            registerCurrentSession();
        };

        if (socket.readyState === WebSocket.OPEN) {
            handleOpen();
        } else {
            socket.onopen = handleOpen;
        }

        return () => {
            socket.onopen = null;
            socket.onmessage = null;
            socket.onclose = null;
        };
    }, [connectionString, webSocketMessageHandler, registerCurrentSession]);

    return { ws, addMessageHandler };
}

export const useMessageHandler = () => {
    return useContext(MessageHandlerContext);
};
