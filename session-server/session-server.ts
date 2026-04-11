import { WebSocketServer, WebSocket } from 'ws';
import { WEBSOCKET_SESSION_SERVER_PORT, MessageTypes, WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY, WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC } from './session-common';
import assert from 'assert';

const GC_INTERVAL_MS = 3600 * 1000; // One hour

interface ConnectedSession
{
    ws: WebSocket;
    initiatorKey: string;
    abandonedMark?: boolean;
}

type ConnectedSyncObjectSession = ConnectedSession;

const connectedSessions: Array<ConnectedSession> = [];
const registeredSyncObjectConnections: { [ x: string ]: Array<ConnectedSyncObjectSession>; } = {};

function updateSessionLastContact<T extends ConnectedSession>(session: T)
{
    session.abandonedMark = false;
}

console.log(`WEBSOCKET_SESSION_SERVER_PORT: ${WEBSOCKET_SESSION_SERVER_PORT}`);
const wss = new WebSocketServer({
    port: 28199, // WEBSOCKET_SESSION_SERVER_PORT,
    perMessageDeflate: {
        zlibDeflateOptions: {
            // See zlib defaults.
            chunkSize: 1024,
            memLevel: 7,
            level: 3
        },
        zlibInflateOptions: {
            chunkSize: 10 * 1024
        },
        // Other options settable:
        clientNoContextTakeover: true, // Defaults to negotiated value.
        serverNoContextTakeover: true, // Defaults to negotiated value.
        serverMaxWindowBits: 10, // Defaults to negotiated value.
        // Below options specified as default values.
        concurrencyLimit: 50, // Limits zlib concurrency for perf.
        threshold: 1024 // Size (in bytes) below which messages
        // should not be compressed if context takeover is disabled.
    }
});

function registerSession(ws: WebSocket, initiatorKey: string) 
{
    assert(typeof initiatorKey === 'string', `initiatorKey must be of type string, not ${typeof initiatorKey}`);
    connectedSessions.push({ ws, initiatorKey });
};

function registerSyncObjectConnection(ws: WebSocket, syncObjectId: string) 
{
    assert(typeof syncObjectId === 'string', `syncObjectId must be of type string, not ${typeof syncObjectId}`);
    if (!registeredSyncObjectConnections[ syncObjectId ])
    {
        registeredSyncObjectConnections[ syncObjectId ] = [];
    }
    registeredSyncObjectConnections[ syncObjectId ].push({ ws, initiatorKey: syncObjectId });
};

const buildMessage = (messageType: MessageTypes, target?: string, data?: { [ x: string ]: any; }) =>
{
    const result: any = {
        'type': messageType,
        target,
        data,
    };

    return JSON.stringify(result);
};

const dispatchMessageToEveryone = (messageType: MessageTypes, targets?: Array<string> | string, data?: { [ x: string ]: any; }) =>
{
    connectedSessions.forEach(session =>
    {
        if (session.initiatorKey === undefined) { return; }
        console.log(`Sending ${messageType} to user ${session.initiatorKey}`);
        session.ws.send(buildMessage(messageType, undefined, data));
        updateSessionLastContact(session);
    });

    if (typeof targets === 'string')
    {
        dispatchToSyncObjectListeners(messageType, targets, data);
    }
    else
    {
        console.log('targets', targets);
        targets?.map((target) =>
        {
            dispatchToSyncObjectListeners(messageType, target, data);
        });
    }
};

const dispatchToSyncObjectListeners = (messageType: MessageTypes, syncObjectId: string, data?: { [ x: string ]: any; }) =>
{
    if (!registeredSyncObjectConnections[ syncObjectId ])
    {
        console.log(`Dispatch was requested on an object with no listeners!`);
        return;
    }
    const message = buildMessage(messageType, syncObjectId, data);
    registeredSyncObjectConnections[ syncObjectId ].map(
        (session: ConnectedSyncObjectSession) =>
        {
            const { ws: listenerWS, initiatorKey } = session;
            assert(typeof initiatorKey !== 'undefined', `initiatorKey must be defined!`);
            assert(initiatorKey === syncObjectId, `ID confusion on sync object!`);
            console.log(`Sending ${messageType} to sync-sock ${syncObjectId}`);
            listenerWS.send(message);
            updateSessionLastContact(session);
        });
};

function validateServerMessage(data: { [ x: string ]: any; })
{
    if (!('authKey' in data)) { throw Error(`Missing "authKey" in server data!`); }
    if (data[ 'authKey' ] !== WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY) { throw Error(`Invalid "authKey" in server data!`); };
}

function handleServerMessage(data: { [ x: string ]: any; }) 
{
    try
    {
        validateServerMessage(data);
        console.log(`Server message ${data[ 'type' ]}`);
        delete data[ 'authKey' ];
        dispatchMessageToEveryone(data[ 'type' ], data[ 'targets' ], data[ 'data' ]);
    } catch (e: unknown)
    {
        console.error('Server message error: ', e);
    }
};

wss.on('connection', (ws) =>
{
    console.log(`[WebSocket] : New connection!`);
    ws.on('error', () => console.error('[WebSocket] : connection error!'));

    ws.on('message', (dataString) =>
    {
        console.log(`[WebSocket] : Data: ${dataString}`);

        const data = JSON.parse(dataString.toString());

        if (data[ 'sender' ] === WEBSOCKET_SESSION_SERVER_SENDER_SERVER_MAGIC)
        {
            handleServerMessage(data);
        }

        if (data[ 'type' ] === MessageTypes.REGISTER_SESSION)
        {
            registerSession(ws, data[ 'initiatorKey' ]);
            return;
        }
        else if (data[ 'type' ] === MessageTypes.REGISTER_SYNC_PROVIDER)
        {
            registerSyncObjectConnection(ws, data[ 'syncObjectId' ]);
            return;
        }
    });
});

function handleAbandonedSession<T extends ConnectedSession>(purgeList: Array<T>, session: T)
{
    if (!session.abandonedMark) { return markSessionAbandoned(session); } // Not abandoned, mark for next round
    purgeList.push(session);
}

function markSessionAbandoned<T extends ConnectedSession>(session: T)
{
    session.abandonedMark = true;
}

function abandonedSessionsGC()
{
    const gcStartTime = Date.now();
    console.log(`[GC] : Beginning Session GC ${gcStartTime}`);


    const syncSessionsToRemove: Array<ConnectedSession> = [];
    for (const syncId in registeredSyncObjectConnections)
    {
        registeredSyncObjectConnections[ syncId ].map(
            (session) => handleAbandonedSession(syncSessionsToRemove, session)
        );
    }

    const sessionsToRemove: Array<ConnectedSession> = [];
    for (const userId in connectedSessions)
    {
        const session = connectedSessions[ userId ];
        handleAbandonedSession(sessionsToRemove, session);
    }


    // Shallow copy to avoid changing size of the dict midway
    for (const syncId in { ...registeredSyncObjectConnections })
    {
        const filteredSessions = registeredSyncObjectConnections[ syncId ]
            .filter(
                (session => (!syncSessionsToRemove.includes(session)))
            );

        if (0 < filteredSessions.length)
        {
            registeredSyncObjectConnections[ syncId ] = filteredSessions;
        }
        else
        {
            console.log(`[GC] : Removing sync object ${syncId}`);
            delete registeredSyncObjectConnections[ syncId ];
        }
    }

    // Shallow copy to avoid changing size of the dict midway
    for (const userId in { ...connectedSessions })
    {
        const session = connectedSessions[ userId ];
        if (sessionsToRemove.includes(session))
        {
            console.log(`[GC] : Removing session ${userId}`);
            delete connectedSessions[ userId ];
        }
    }

    const gcDuration = Date.now() - gcStartTime;
    console.log(`[GC] : Session GC took ${gcDuration / 1000} seconds`);
}

setInterval(abandonedSessionsGC, GC_INTERVAL_MS);

export default wss;
