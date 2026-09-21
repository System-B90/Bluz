// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The realtime layer fails silently by design — the client retries forever and
 * every spec drives one browser whose own writes update its own view. This
 * component is the only thing that makes "the socket never connected"
 * observable, so its own contract has to hold (#636).
 */

const socketRef: { current: null | { readyState: number; url?: string } } = {
    current: null,
};

const WS_URL = "wss://bluz.dev:8443/ws/";

import { RealtimeStatus } from "@/components/base/RealtimeStatus";

// The component takes the socket ref as a prop rather than calling the
// connection hook itself (that hook opens a socket; AuthProvider owns the one
// call). Cast: the spec drives a minimal fake, not a real WebSocket.
const ws = socketRef as unknown as Parameters<typeof RealtimeStatus>[0]["ws"];

beforeEach(() => {
    vi.useFakeTimers();
    socketRef.current = null;
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

function currentState(): null | string {
    return screen
        .getByTestId("realtime-status")
        .getAttribute("data-realtime-state");
}

function currentHost(): null | string {
    return screen
        .getByTestId("realtime-status")
        .getAttribute("data-realtime-host");
}

describe("RealtimeStatus", () => {
    it("reports closed while no socket exists", () => {
        render(<RealtimeStatus ws={ws} />);

        expect(currentState()).toBe("closed");
    });

    it("reports connecting while the socket is still opening", () => {
        socketRef.current = { readyState: WebSocket.CONNECTING, url: WS_URL };
        render(<RealtimeStatus ws={ws} />);

        expect(currentState()).toBe("connecting");
    });

    it("picks up the socket opening without a re-render of its own", () => {
        // The package hands out a ref, so nothing notifies this component when
        // the socket is replaced on a reconnect — it samples instead.
        render(<RealtimeStatus ws={ws} />);
        expect(currentState()).toBe("closed");

        socketRef.current = { readyState: WebSocket.OPEN, url: WS_URL };
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(currentState()).toBe("open");
    });

    it("reports closed again once the socket drops", () => {
        socketRef.current = { readyState: WebSocket.OPEN, url: WS_URL };
        render(<RealtimeStatus ws={ws} />);
        expect(currentState()).toBe("open");

        socketRef.current = { readyState: WebSocket.CLOSED, url: WS_URL };
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(currentState()).toBe("closed");
    });

    it("publishes the host the socket is pointed at", () => {
        // "A socket is open" is not the useful assertion: the bug was an
        // address. A machine running another stack answers on the wrong one,
        // and the connection then looks perfectly healthy.
        socketRef.current = { readyState: WebSocket.OPEN, url: WS_URL };
        render(<RealtimeStatus ws={ws} />);

        expect(currentHost()).toBe("bluz.dev:8443");
    });

    it("publishes no host while there is no socket", () => {
        render(<RealtimeStatus ws={ws} />);

        expect(currentHost()).toBe("");
    });

    it("stays out of the visible UI", () => {
        render(<RealtimeStatus ws={ws} />);

        expect(screen.getByTestId("realtime-status").hidden).toBe(true);
    });
});
