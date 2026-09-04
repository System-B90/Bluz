// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEventLockLifecycle } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventLockLifecycle";
import { LOCK_HEARTBEAT_MS } from "@/components/schedule/calendar/calendar-provider/lock-state";

/**
 * The lock is what stops two people editing the same event at once, so it has
 * to survive for exactly as long as the dialog is open: no shorter, and no
 * longer than the page.
 */

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
});

function renderLifecycle(openId: null | string) {
    const lockEvent = vi.fn();
    const unlockEvent = vi.fn();
    const view = renderHook(
        ({ id, unlock }: { id: null | string; unlock: typeof unlockEvent }) =>
            useEventLockLifecycle(id, lockEvent, unlock),
        { initialProps: { id: openId, unlock: unlockEvent } },
    );
    return { lockEvent, unlockEvent, view };
}

describe("useEventLockLifecycle (#629)", () => {
    it("keeps the lock when the unlock callback's identity changes", () => {
        // CalendarContext rebuilds its callbacks on any provider state change.
        // That used to tear down the release effect, whose cleanup unlocked
        // the event — while the dialog was still open, and with nothing left
        // to re-lock it, so another client could start editing the same event.
        const { lockEvent, unlockEvent, view } = renderLifecycle("e1");

        expect(lockEvent).toHaveBeenCalledWith("e1");

        // A fresh function identity each time, delegating to the same spy —
        // exactly what a rebuilt useCallback looks like to this hook.
        act(() => {
            view.rerender({ id: "e1", unlock: (id) => unlockEvent(id) });
        });
        act(() => {
            view.rerender({ id: "e1", unlock: (id) => unlockEvent(id) });
        });

        expect(unlockEvent).not.toHaveBeenCalled();
    });

    it("releases the lock when the dialog closes", () => {
        const { unlockEvent, view } = renderLifecycle("e1");

        act(() => {
            view.rerender({ id: null, unlock: unlockEvent });
        });

        expect(unlockEvent).toHaveBeenCalledWith("e1");
    });

    it("moves the lock when the dialog switches to another event", () => {
        const { lockEvent, unlockEvent, view } = renderLifecycle("e1");

        act(() => {
            view.rerender({ id: "e2", unlock: unlockEvent });
        });

        expect(unlockEvent).toHaveBeenCalledWith("e1");
        expect(lockEvent).toHaveBeenCalledWith("e2");
    });

    it("releases the lock when the page goes away", () => {
        const { unlockEvent, view } = renderLifecycle("e1");

        act(() => {
            view.unmount();
        });

        expect(unlockEvent).toHaveBeenCalledWith("e1");
    });

    it("re-emits the lock on the heartbeat while the dialog stays open", () => {
        const { lockEvent } = renderLifecycle("e1");

        act(() => {
            vi.advanceTimersByTime(LOCK_HEARTBEAT_MS * 2);
        });

        // The initial lock plus two heartbeats.
        expect(lockEvent).toHaveBeenCalledTimes(3);
    });

    it("locks nothing while no dialog is open", () => {
        const { lockEvent, unlockEvent } = renderLifecycle(null);

        expect(lockEvent).not.toHaveBeenCalled();
        expect(unlockEvent).not.toHaveBeenCalled();
    });
});
