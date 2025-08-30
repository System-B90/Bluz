import { MessageTypes, WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC, WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY, NEXT_PUBLIC_WEBSOCKET_SESSION_SERVER_CONN_STRING } from "@/settings";

export function SendServerRequestToSessionServer(type: MessageTypes, data?: any)
{
    const ws = new WebSocket(NEXT_PUBLIC_WEBSOCKET_SESSION_SERVER_CONN_STRING);
    ws.onopen = () =>
    {
        ws.send(
            JSON.stringify(
                {
                    'sender': WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC,
                    'authKey': WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY,
                    'type': type,
                    data,
                }
            )
        );
    };
};
