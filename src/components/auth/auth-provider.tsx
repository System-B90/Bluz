'use client';
import useSessionWebSocketContext, { MessageHandlerType } from '@/components/session-ws';
import
{
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';
import { MessageTypes } from '../../session-server/src/common';
import assert from 'assert';

assert(!!process.env.NEXT_PUBLIC_MADRAT_USERNAME, 'NEXT_PUBLIC_MADRAT_USERNAME must be defined in environment!');

export interface WebSocketSessionMessage
{
    type: MessageTypes,
    [ key: string ]: any,
}
export type AuthContextState = {
    default: boolean;
    username: string | null;
    displayName: string | null;
    isAdmin: boolean;
    addMessageHandler: (handler: MessageHandlerType) => () => void;
    sendMessage: (data: WebSocketSessionMessage) => void;
};

const AuthContext = createContext<AuthContextState | undefined>({
    default: true,
    username: null,
    displayName: null,
    isAdmin: false,
    addMessageHandler: (_handler: MessageHandlerType) => () => { },
    sendMessage: (_data) => { },
});

export const AuthProvider = ({ children, username }: { children: React.ReactNode; username: string | null; }) =>
{
    const [ isAdmin, setIsAdmin ] = useState<boolean>(true);
    const { ws, addMessageHandler } = useSessionWebSocketContext();

    const displayName = 'מיכאל';

    const onWebSocketMessage: MessageHandlerType = useCallback((messageType: MessageTypes, data: any) =>
    {
        console.log(`[onWebSocketMessage] ${messageType} => ${data}`);
    }, []);

    useEffect(() =>
    {
        if (typeof window === 'undefined') { return; }

        return addMessageHandler(onWebSocketMessage);
    }, [ addMessageHandler, onWebSocketMessage ]);

    const sendMessage = useCallback((data: WebSocketSessionMessage) =>
    {
        if (!ws.current) { return; }

        if (ws.current.OPEN !== ws.current.readyState)
        {
            setTimeout(() =>
            {
                sendMessage(data);
            }, 50);
        }
        else
        {
            ws.current.send(JSON.stringify(data));
        }
    }, [ ws ]);

    useEffect(() =>
    {
        setIsAdmin(username === process.env.NEXT_PUBLIC_MADRAT_USERNAME);
    }, [ username, setIsAdmin ]);

    return (
        <AuthContext.Provider value={ {
            default: false,
            username,
            displayName,
            isAdmin,
            addMessageHandler, sendMessage,

        } }>
            { children }
        </AuthContext.Provider>
    );
};

export const useAuth = () =>
{
    const context = useContext(AuthContext);

    if (context === undefined || context.default)
    {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
};
