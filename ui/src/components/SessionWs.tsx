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

const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 30_000;

/**
 * Custom hook to establish and manage client-side WebSocket sessions.
 * Manages event listener registrations, session heartbeats, and auto-reconnection
 * with exponential backoff on close/error.
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
    const reconnectAttempt = useRef(0);
    const reconnectTimer = useRef<null | ReturnType<typeof setTimeout>>(null);
    const isMounted = useRef(true);
    // Ref to break the circular dependency: onclose calls connect via ref so it
    // always dispatches the latest closure without ESLint's forward-ref warning.
    const connectRef = useRef<() => void>(() => {});

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
        messageHandlers.current.forEach((handler) => handler(type, data));
    }, []);

    const registerCurrentSession = useCallback((socket: WebSocket) => {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;

        socket.send(
            JSON.stringify({
                type: MessageTypes.REGISTER_SESSION,
                initiatorKey: crypto.randomUUID(),
            }),
        );
    }, []);

    const connect = useCallback(() => {
        if (!isMounted.current) return;

        const socket = new WebSocket(connectionString);
        ws.current = socket;

        socket.onopen = () => {
            console.log("[WS] Connection established");
            reconnectAttempt.current = 0;
            registerCurrentSession(socket);
        };

        socket.onmessage = webSocketMessageHandler;

        socket.onclose = () => {
            ws.current = null;
            if (!isMounted.current) return;
            const delay = Math.min(
                RECONNECT_BASE_MS * Math.pow(2, reconnectAttempt.current),
                RECONNECT_MAX_MS,
            );
            reconnectAttempt.current += 1;
            console.log(`[WS] Connection closed, reconnecting in ${delay}ms`);
            reconnectTimer.current = setTimeout(
                () => connectRef.current(),
                delay,
            );
        };

        socket.onerror = () => {
            console.error("[WS] Connection error");
            socket.close();
        };
    }, [connectionString, webSocketMessageHandler, registerCurrentSession]);

    useEffect(() => {
        // Keep the ref in sync so onclose always calls the latest closure.
        connectRef.current = connect;
        isMounted.current = true;
        connect();

        return () => {
            isMounted.current = false;
            if (reconnectTimer.current !== null) {
                clearTimeout(reconnectTimer.current);
                reconnectTimer.current = null;
            }
            if (ws.current) {
                ws.current.onclose = null;
                ws.current.close();
                ws.current = null;
            }
        };
    }, [connect]);

    return { ws, addMessageHandler };
}

export const useMessageHandler = () => {
    return useContext(MessageHandlerContext);
};
