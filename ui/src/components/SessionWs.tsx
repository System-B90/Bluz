import { createContext, useCallback, useContext, useEffect, useRef } from "react";

import { useWebSocketConfig } from "@/components/WebsocketConfigProvider";
import { MessageTypes } from "@/settings";

export type MessageHandlerType = (messageType: MessageTypes, messageTarget: string, data: any) => void;
const MessageHandlerContext = createContext<MessageHandlerType>(() => { });

export default function useSessionWebSocketContext()
{
    const { connectionString } = useWebSocketConfig();

    const ws = useRef<WebSocket | null>(null);
    const messageHandlers = useRef<MessageHandlerType[]>([]);

    const addMessageHandler = useCallback((handler: MessageHandlerType) =>
    {
        if (typeof window === 'undefined') return () => { };

        messageHandlers.current.push(handler);

        return () =>
        {
            messageHandlers.current = messageHandlers.current.filter(h => h !== handler);
        };
    }, []);

    const webSocketMessageHandler = useCallback((ev: MessageEvent<any>) =>
    {
        const data = JSON.parse(ev.data);
        const { type, target }: { type: MessageTypes, target: string; } = data;
        console.log(`[WS] Message type: ${type}`);
        messageHandlers.current.forEach(handler => handler(type, target, data));
    }, []);

    const registerCurrentSession = useCallback(() =>
    {
        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;

        ws.current.send(JSON.stringify({
            type: MessageTypes.REGISTER_SESSION,
            initiatorKey: crypto.randomUUID()
        }));
    }, []);

    useEffect(() =>
    {
        if (ws.current == null)
        {
            ws.current = new WebSocket(connectionString);
        }

        const socket = ws.current;

        socket.onclose = () => console.log('ws closed');
        socket.onmessage = webSocketMessageHandler;

        const handleOpen = () =>
        {
            console.log("Connection is made");
            registerCurrentSession();
        };

        if (socket.readyState === WebSocket.OPEN)
        {
            handleOpen();
        } else
        {
            socket.onopen = handleOpen;
        }

        return () =>
        {
            socket.onopen = null;
            socket.onmessage = null;
            socket.onclose = null;
        };
    }, [ connectionString, webSocketMessageHandler, registerCurrentSession ]);

    return { ws, addMessageHandler };
}

export const useMessageHandler = () =>
{
    return useContext(MessageHandlerContext);
};
