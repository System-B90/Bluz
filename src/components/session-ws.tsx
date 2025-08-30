import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { MessageTypes, NEXT_PUBLIC_WEBSOCKET_SESSION_SERVER_CONN_STRING } from "../session-server/src/common";

export type MessageHandlerType = (messageType: MessageTypes, data: any) => void;
const MessageHandlerContext = createContext<MessageHandlerType>(() => { });
export default function useSessionWebSocketContext()
{
    const ws = useRef<WebSocket | null>(null);
    const messageHandlers = useRef<MessageHandlerType[]>([]);

    // Function for child components to register their own message handlers
    const addMessageHandler = useCallback((handler: MessageHandlerType) =>
    {
        if (typeof (window) === 'undefined') { return () => { }; }
        messageHandlers.current.push(handler);
        return () =>
        { // Return a cleanup function to remove the handler
            messageHandlers.current = messageHandlers.current.filter(h => h !== handler);
        };
    }, []);

    const webSocketMessageHandler = useCallback((ev: MessageEvent<any>) =>
    {
        const content = JSON.parse(ev.data);
        const { type, data }: { type: MessageTypes, data: any; } = content;
        console.log(`[WS] Message type: ${type}`);

        // Call all registered message handlers
        messageHandlers.current.forEach(handler => handler(type, data));

    }, []);

    const waitForSocketConnection = useCallback((socket: WebSocket, callback: (() => void) | null) =>
    {
        setTimeout(
            function ()
            {
                if (socket.readyState === 1)
                {
                    console.log("Connection is made");
                    if (callback != null)
                    {
                        callback();
                    }
                } else
                {
                    console.log("wait for connection...");
                    waitForSocketConnection(socket, callback);
                }

            }, 5); // wait 5 milisecond for the connection...
    }, []);

    const registerCurrentSession = useCallback(async () =>
    {
        if (!ws.current) { return; }
        ws.current.send(JSON.stringify({ 'type': MessageTypes.REGISTER_SESSION, 'initiatorKey': crypto.randomUUID() }));
    }, []);

    // Register WebSocket functions
    useEffect(() =>
    {
        if (!ws.current) { return; }
        ws.current.onopen = () => { };
        ws.current.onclose = () => console.log('ws closed');

        ws.current.onmessage = (ev: MessageEvent<any>) => webSocketMessageHandler(ev);

        waitForSocketConnection(
            ws.current,
            () =>
            {
                registerCurrentSession();
            }
        );

    }, [ waitForSocketConnection, webSocketMessageHandler, registerCurrentSession ]);

    useMemo(() =>
    {
        if (ws.current) { return; }
        ws.current = new WebSocket(NEXT_PUBLIC_WEBSOCKET_SESSION_SERVER_CONN_STRING);
    }, []);

    return { ws, addMessageHandler };
}

export const useMessageHandler = () =>
{
    return useContext(MessageHandlerContext);
};
