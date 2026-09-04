// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The realtime layer fails silently by design — the client retries forever and
 * every spec drives one browser whose own writes update its own view. This
 * component is the only thing that makes "the socket never connected"
 * observable, so its own contract has to hold (#636).
 */

const socketRef: { current: null | { readyState: number } } = { current: null };

vi.mock("@/components/SessionWs", () => ({
    useSessionWebSocketContext: () => ({ ws: socketRef }),
}));

import { RealtimeStatus } from "@/components/base/RealtimeStatus";

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

describe("RealtimeStatus", () => {
    it("reports closed while no socket exists", () => {
        render(<RealtimeStatus />);

        expect(currentState()).toBe("closed");
    });

    it("reports connecting while the socket is still opening", () => {
        socketRef.current = { readyState: WebSocket.CONNECTING };
        render(<RealtimeStatus />);

        expect(currentState()).toBe("connecting");
    });

    it("picks up the socket opening without a re-render of its own", () => {
        // The package hands out a ref, so nothing notifies this component when
        // the socket is replaced on a reconnect — it samples instead.
        render(<RealtimeStatus />);
        expect(currentState()).toBe("closed");

        socketRef.current = { readyState: WebSocket.OPEN };
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(currentState()).toBe("open");
    });

    it("reports closed again once the socket drops", () => {
        socketRef.current = { readyState: WebSocket.OPEN };
        render(<RealtimeStatus />);
        expect(currentState()).toBe("open");

        socketRef.current = { readyState: WebSocket.CLOSED };
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(currentState()).toBe("closed");
    });

    it("stays out of the visible UI", () => {
        render(<RealtimeStatus />);

        expect(screen.getByTestId("realtime-status").hidden).toBe(true);
    });
});
