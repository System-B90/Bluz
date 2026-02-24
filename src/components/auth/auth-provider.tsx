'use client';
import useSessionWebSocketContext, { MessageHandlerType } from '@/components/session-ws';
import { useSession, signIn, SessionProvider, SessionContextValue } from 'next-auth/react';
import
{
    createContext,
    useCallback,
    useContext,
    useEffect,
} from 'react';
import { MessageTypes } from '../../session-server/src/common';
import { AuthSessionData } from '@/api-shared/types/sso';
import { Clearance } from '@/api-server/hive/types';
import { useRouter } from 'next/navigation';

export interface WebSocketSessionMessage
{
    type: MessageTypes;
    [ key: string ]: any;
}

export type AuthContextState = {
    default: boolean;
    hiveId: number | string | null;
    username: string | null;
    displayName: string | null;
    avatarImage: string | null,
    clearance: Clearance;
    status: 'loading' | 'authenticated' | 'unauthenticated';
    addMessageHandler: (handler: MessageHandlerType) => () => void;
    sendMessage: (data: WebSocketSessionMessage) => void;
};

const AuthContext = createContext<AuthContextState | undefined>(undefined);

const AuthProviderInner = ({ children }: { children: React.ReactNode; }) =>
{
    const { data: session, status } = useSession() as SessionContextValue<false> & { data: null | AuthSessionData; };
    const { ws, addMessageHandler } = useSessionWebSocketContext();

    const router = useRouter();

    useEffect(() =>
    {
        if (status === 'unauthenticated')
        {
            router.push('/login');
        }
    }, [ status, router ]);

    // 3. Map Hive session data to your local context
    const username = session?.user?.username || null;
    const displayName = session?.user?.display_name || 'Guest';
    const avatarImage = session?.user?.image ?? null;

    const onWebSocketMessage: MessageHandlerType = useCallback((messageType: MessageTypes, data: any) =>
    {
        console.log(`[onWebSocketMessage] ${messageType} => ${data}`);
    }, []);

    useEffect(() =>
    {
        if (typeof window === 'undefined' || status !== 'authenticated') { return; }
        return addMessageHandler(onWebSocketMessage);
    }, [ addMessageHandler, onWebSocketMessage, status ]);

    const sendMessage = useCallback((data: WebSocketSessionMessage) =>
    {
        if (!ws.current || status !== 'authenticated') { return; }

        if (ws.current.OPEN !== ws.current.readyState)
        {
            setTimeout(() => sendMessage(data), 50);
        } else
        {
            ws.current.send(JSON.stringify(data));
        }
    }, [ ws, status ]);

    if (status === 'loading' || status === 'unauthenticated')
    {
        return null; // Or a <LoadingSpinner />
    }

    return (
        <AuthContext.Provider value={ {
            default: false,
            hiveId: session?.user.id ?? null,
            username,
            displayName,
            avatarImage,
            clearance: session?.user.clearance ?? Clearance.Logged_Out,
            status,
            addMessageHandler,
            sendMessage,
        } }>
            { children }
        </AuthContext.Provider>
    );
};

export const useAuth = () =>
{
    const context = useContext(AuthContext);
    if (context === undefined)
    {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode; }) =>
{
    return (
        <AuthProviderInner>
            { children }
        </AuthProviderInner>
    );
};
