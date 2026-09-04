"use client";
import { useEffect, useState } from "react";

import { useSessionWebSocketContext } from "@/components/SessionWs";

/** How often the socket's readyState is sampled into the DOM. */
const POLL_MS = 500;

export type RealtimeState = "closed" | "connecting" | "open";

/**
 * Attribute the state is published under, and the element carrying it.
 * Exported so specs assert against one name rather than a copied string.
 */
export const REALTIME_STATE_ATTRIBUTE = "data-realtime-state";
export const REALTIME_STATUS_TEST_ID = "realtime-status";

function readState(socket: null | WebSocket): RealtimeState {
    if (!socket) return "closed";
    if (socket.readyState === WebSocket.OPEN) return "open";
    if (socket.readyState === WebSocket.CONNECTING) return "connecting";
    return "closed";
}

/**
 * Publishes the browser's WebSocket connection state into the DOM.
 *
 * The realtime layer fails silently by design: `SessionWs` logs a console
 * error and retries on a backoff forever, and every spec drives a single
 * browser whose own writes update its own view regardless. That made "realtime
 * is entirely dead" indistinguishable from "realtime is fine" — the whole
 * client side of it was down in e2e for months while the suite stayed green
 * (#636). This renders nothing visible; it exists so a test can tell the two
 * apart.
 *
 * The state is sampled rather than subscribed to because the package exposes
 * the socket as a ref, which gives no notification when it is replaced on a
 * reconnect.
 */
export function RealtimeStatus() {
    const { ws } = useSessionWebSocketContext();
    const [state, setState] = useState<RealtimeState>("closed");

    useEffect(() => {
        const sample = () => {
            setState((previous) => {
                const next = readState(ws.current);
                return next === previous ? previous : next;
            });
        };

        sample();
        const interval = setInterval(sample, POLL_MS);
        return () => clearInterval(interval);
    }, [ws]);

    return (
        <span
            data-realtime-state={state}
            data-testid={REALTIME_STATUS_TEST_ID}
            hidden
        />
    );
}
