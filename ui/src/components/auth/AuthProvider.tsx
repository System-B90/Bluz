"use client";

import { signOut, useSession } from "next-auth/react";
import { useSnackbar } from "notistack";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
} from "react";

import { AuthSessionData, AuthSessionUser } from "@/api-shared/types/sso";
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
    degraded: boolean;
    addMessageHandler: (handler: MessageHandlerType) => () => void;
    sendMessage: (data: WebSocketSessionMessage) => void;
    /**
     * Subscribe to a sync object for scoped broadcasts. Survives reconnects —
     * the transport replays every registered id on each new socket, so callers
     * must not try to re-register on their own (#525).
     */
    registerSyncObject: (syncObjectId: string) => void;
    deregisterSyncObject: (syncObjectId: string) => void;
};

const AuthContext = createContext<AuthContextState | undefined>(undefined);

export const AuthProvider = ({
    children,
    userData,
    degraded = false,
}: {
    children: React.ReactNode;
    userData: AuthSessionUser;
    degraded?: boolean;
}) => {
    const {
        addMessageHandler,
        sendMessage,
        registerSyncObject,
        deregisterSyncObject,
    } = useSessionWebSocketContext();
    const { enqueueSnackbar } = useSnackbar();
    const { data: session } = useSession();

    // next-auth v4 has no public client-side hook for CLIENT_FETCH_ERROR
    // (its logger module isn't part of the package's exports map), so this
    // intercepts the "/api/auth/_log" beacon it POSTs internally.
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
        if (degraded) {
            enqueueSnackbar(
                "הייב אינו זמין כרגע. פועלים במצב מוגבל עם ההתחברות האחרונה שנשמרה.",
                { variant: "warning", persist: true, preventDuplicate: true },
            );
        }
    }, [degraded, enqueueSnackbar]);

    useEffect(() => {
        const sessionData = session as AuthSessionData | null | undefined;
        if (!sessionData || sessionData.error !== "TokenExpiredError") {
            return;
        }

        // A stale token normally forces re-login, but that requires Hive
        // to be up. Only sign out if Hive is actually reachable again.
        let cancelled = false;
        void (async () => {
            try {
                const response = await fetch("/api/auth/hive-status");
                const { reachable } = await response.json();
                if (!cancelled && reachable) {
                    enqueueSnackbar("עבר הרבה זמן... בואו נתחבר מחדש", {
                        variant: "warning",
                    });
                    logout();
                }
            } catch {
                // Status check itself failed; stay on the cached session.
            }
        })();

        return () => {
            cancelled = true;
        };
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

    const contextValue = useMemo<AuthContextState>(
        () => ({
            userData,
            logout,
            canEdit,
            degraded,
            addMessageHandler,
            sendMessage,
            registerSyncObject,
            deregisterSyncObject,
        }),
        [
            logout,
            userData,
            canEdit,
            degraded,
            addMessageHandler,
            sendMessage,
            registerSyncObject,
            deregisterSyncObject,
        ],
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
