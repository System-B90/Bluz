"use client";

import { signOut, useSession } from "next-auth/react";
import { useSnackbar } from "notistack";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from "react";

import { AuthSessionUser } from "@/api-shared/types/sso";
import {
    MessageHandlerType,
    useSessionWebSocketContext,
} from "@/components/SessionWs";
import { MessageTypes } from "@/settings";

export type WebSocketSessionMessage = {
    type: MessageTypes;
    [key: string]: unknown;
};

export type AuthContextState = {
    userData: AuthSessionUser;
    logout: () => void;
    canEdit: boolean;
    addMessageHandler: (handler: MessageHandlerType) => () => void;
    sendMessage: (data: WebSocketSessionMessage) => void;
};

const AuthContext = createContext<AuthContextState | undefined>(undefined);

export const AuthProvider = ({
    children,
    userData,
}: {
    children: React.ReactNode;
    userData: AuthSessionUser;
}) => {
    const { ws, addMessageHandler } = useSessionWebSocketContext();
    const { enqueueSnackbar } = useSnackbar();
    const messageQueue = useRef<Array<WebSocketSessionMessage>>([]);
    const { data: session } = useSession();

    useEffect(() => {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const url =
                typeof args[0] === "string"
                    ? args[0]
                    : args[0] instanceof Request
                        ? args[0].url
                        : "";

            if (url.includes("/api/auth/_log")) {
                try {
                    const init = args[1];
                    if (init && init.body && typeof init.body === "string") {
                        const body = JSON.parse(init.body);
                        if (body.code === "CLIENT_FETCH_ERROR") {
                            enqueueSnackbar(
                                "שגיאת תקשורת עם שרת ההזדהות. ייתכנו שיבושים בפעילות המערכת.",
                                {
                                    variant: "error",
                                    preventDuplicate: true,
                                },
                            );
                        }
                    }
                } catch {
                    // Ignore parse errors
                }
            }

            return await originalFetch(...args);
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, [enqueueSnackbar]);

    const logout = useCallback(() => {
        void signOut({ callbackUrl: "/login" });
    }, []);

    useEffect(() => {
        if (session && (session as any).error === "TokenExpiredError") {
            enqueueSnackbar("עבר הרבה זמן... בואו נתחבר מחדש", {
                variant: "warning",
            });
            logout();
        }
    }, [session, logout, enqueueSnackbar]);

    const canEdit: boolean = !!userData;

    const onWebSocketMessage: MessageHandlerType = useCallback(
        (_messageType: MessageTypes, _data: unknown) => {
            // no-op: auth provider does not handle WS messages
        },
        [],
    );

    useEffect(() => {
        return addMessageHandler(onWebSocketMessage);
    }, [addMessageHandler, onWebSocketMessage]);

    const sendMessage = useCallback(
        (data: WebSocketSessionMessage) => {
            if (!ws?.current) return;

            if (ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify(data));
            } else if (ws.current.readyState === WebSocket.CONNECTING) {
                messageQueue.current.push(data);
            } else {
                console.error("WebSocket is closed. Cannot send message.");
            }
        },
        [ws],
    );

    useEffect(() => {
        if (!ws?.current) return;

        const socketInstance = ws.current;

        const handleSocketOpen = () => {
            while (messageQueue.current.length > 0) {
                const msg = messageQueue.current.shift();
                if (msg) socketInstance.send(JSON.stringify(msg));
            }
        };

        socketInstance.addEventListener("open", handleSocketOpen);

        return () => {
            socketInstance.removeEventListener("open", handleSocketOpen);
        };
    }, [ws]);

    const contextValue = useMemo<AuthContextState>(
        () => ({
            userData,
            logout,
            canEdit,
            addMessageHandler,
            sendMessage,
        }),
        [logout, userData, canEdit, addMessageHandler, sendMessage],
    );

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextState => {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }

    return context;
};
