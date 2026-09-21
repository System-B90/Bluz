"use client";
import { useEffect, useState } from "react";

import type { useSessionWebSocketContext } from "@/components/SessionWs";

/** How often the socket's readyState is sampled into the DOM. */
const POLL_MS = 500;

export type RealtimeState = "closed" | "connecting" | "open";

/**
 * The socket ref owned by the single `useSessionWebSocketContext()` call in
 * `AuthProvider`. Passed down rather than re-invoked here: that hook *opens* a
 * connection, so calling it again would run a second socket in parallel.
 */
export type RealtimeStatusProps = {
    ws: ReturnType<typeof useSessionWebSocketContext>["ws"];
};

/**
 * Attribute the state is published under, and the element carrying it.
 * Exported so specs assert against one name rather than a copied string.
 */
export const REALTIME_STATE_ATTRIBUTE = "data-realtime-state";
export const REALTIME_HOST_ATTRIBUTE = "data-realtime-host";
export const REALTIME_STATUS_TEST_ID = "realtime-status";

function readState(socket: null | WebSocket): RealtimeState {
    if (!socket) return "closed";
    if (socket.readyState === WebSocket.OPEN) return "open";
    if (socket.readyState === WebSocket.CONNECTING) return "connecting";
    return "closed";
}

/** The `host:port` the socket is pointed at, or "" when there is no socket. */
function readHost(socket: null | WebSocket): string {
    if (!socket?.url) return "";
    try {
        return new URL(socket.url).host;
    } catch {
        return "";
    }
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
 * The socket's host is published alongside its state, because "a socket is
 * open" is not the assertion worth making on its own: the bug was an address,
 * not an outage. A developer machine that also runs the dev stack has
 * something listening on the wrong address, so the browser connects there and
 * the connection looks healthy while pointing at a different deployment
 * entirely. Comparing this against the page's own origin is what catches that.
 *
 * The state is sampled rather than subscribed to because the package exposes
 * the socket as a ref, which gives no notification when it is replaced on a
 * reconnect.
 */
export function RealtimeStatus({ ws }: RealtimeStatusProps) {
    const [state, setState] = useState<RealtimeState>("closed");
    const [host, setHost] = useState<string>("");

    useEffect(() => {
        const sample = () => {
            setState((previous) => {
                const next = readState(ws.current);
                return next === previous ? previous : next;
            });
            setHost((previous) => {
                const next = readHost(ws.current);
                return next === previous ? previous : next;
            });
        };

        sample();
        const interval = setInterval(sample, POLL_MS);
        return () => clearInterval(interval);
    }, [ws]);

    return (
        <span
            data-realtime-host={host}
            data-realtime-state={state}
            data-testid={REALTIME_STATUS_TEST_ID}
            hidden
        />
    );
}
