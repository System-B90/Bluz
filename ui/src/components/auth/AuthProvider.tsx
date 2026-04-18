"use client";

import { signOut } from "next-auth/react";
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

export interface WebSocketSessionMessage {
  type: MessageTypes;
  [key: string]: unknown;
}

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
  const messageQueue = useRef<WebSocketSessionMessage[]>([]);

  const canEdit: boolean = !!userData;

  const onWebSocketMessage: MessageHandlerType = useCallback(
    (messageType: MessageTypes, data: unknown) => {
      console.log(`[onWebSocketMessage] ${messageType}`, data);
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

  const logout = useCallback(() => {
    // No return from this function
    void signOut({ callbackUrl: "/login" });
  }, []);

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
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextState => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
