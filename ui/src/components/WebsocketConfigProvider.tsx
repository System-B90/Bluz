"use client";

import { createContext, useContext, ReactNode, useMemo } from "react";

interface WebSocketConfigContextType
{
    host: string;
    protocol: string;
    portSuffix: string;
    connectionString: string;
}

;

const WebSocketConfigContext = createContext<WebSocketConfigContextType>({ host: "localhost", protocol: 'ws', portSuffix: ':28199', connectionString: 'ws://localhost:8193/' });

interface WebSocketConfigProviderProps
{
    host: string;
    protocol: string;
    portSuffix: string;
    children: ReactNode;
}

export function WebSocketConfigProvider({ host, protocol, portSuffix, children }: WebSocketConfigProviderProps)
{
    const context = useMemo(() =>
    {
        const connectionString = `${protocol}://${host}${portSuffix}/ws/`;;
        return { host, protocol, portSuffix, connectionString };
    }, [ host, protocol, portSuffix ]);

    return (
        <WebSocketConfigContext.Provider value={ context }>
            { children }
        </WebSocketConfigContext.Provider>
    );
}

export function useWebSocketConfig()
{
    return useContext(WebSocketConfigContext);
}
