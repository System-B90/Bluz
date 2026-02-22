import assert from 'assert';

export const SECURE_CONTEXT_ONLY = false; //process.env.NODE_ENV !== 'development' && (!process.env.HTTP_ONLY);
export const NEXT_PUBLIC_WEBSOCKET_SESSION_SERVER_PORT = process.env.NEXT_PUBLIC_WEBSOCKET_SESSION_SERVER_PORT;
export const WEBSOCKET_SESSION_SERVER_INTERNAL_PORT = parseInt(process.env.WEBSOCKET_SESSION_SERVER_INTERNAL_PORT ?? '8089');
export const NEXT_PUBLIC_WEBSOCKET_SESSION_SERVER_HOST = process.env.NEXT_PUBLIC_WEBSOCKET_SESSION_SERVER_HOST;
export const NEXT_PUBLIC_WEBSOCKET_SESSION_SERVER_CONN_STRING = `${SECURE_CONTEXT_ONLY ? 'wss' : 'ws'}://${NEXT_PUBLIC_WEBSOCKET_SESSION_SERVER_HOST}:${NEXT_PUBLIC_WEBSOCKET_SESSION_SERVER_PORT}/`;

export const WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC = 'server';
export const WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY = process.env.WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY;
// Currently no assert since this executes on the client for some reason as well
assert(WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY || (typeof window !== 'undefined'), `WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY must be set in environment variables!`);

export enum MessageTypes 
{
    REGISTER_SESSION = 'register-session',
    EVENT_DATA_UPDATE = 'pdu',
    EVENT_ADDED_OR_REMOVED = 'par',

    SETTINGS_UPDATE = 'su',
};
