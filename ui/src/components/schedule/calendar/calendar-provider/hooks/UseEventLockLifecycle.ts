"use client";
import { useEffect, useRef } from "react";

import { LOCK_HEARTBEAT_MS } from "@/components/schedule/calendar/calendar-provider/lock-state";
import { EventId } from "@/components/schedule/types/event";

/**
 * Holds an event lock for as long as its dialog is open.
 *
 * Broadcasts a lock when a dialog opens on an existing event, re-emits it on a
 * heartbeat so other clients keep seeing it (and clients that connected later
 * learn about it), and releases it when the dialog closes or the page goes
 * away. The held id is tracked in a ref so the matching unlock fires however
 * the dialog was opened or closed.
 *
 * @param openId The event whose dialog is open, or `null` when none is.
 * @param lockEvent Broadcasts a lock for an event.
 * @param unlockEvent Releases the lock on an event.
 */
export function useEventLockLifecycle(
    openId: EventId | null,
    lockEvent: (eventId: EventId) => void,
    unlockEvent: (eventId: EventId) => void,
): void {
    const lockedEventIdRef = useRef<EventId | null>(null);

    useEffect(() => {
        if (lockedEventIdRef.current === openId) return;

        if (lockedEventIdRef.current !== null) {
            unlockEvent(lockedEventIdRef.current);
        }
        if (openId !== null) {
            lockEvent(openId);
        }
        lockedEventIdRef.current = openId;
    }, [openId, lockEvent, unlockEvent]);

    useEffect(() => {
        if (openId === null) return;

        const interval = setInterval(() => {
            lockEvent(openId);
        }, LOCK_HEARTBEAT_MS);
        return () => clearInterval(interval);
    }, [openId, lockEvent]);

    // Read `unlockEvent` through a ref so the release effect below runs once
    // for the page's lifetime. Keyed on the callback itself, it re-ran
    // whenever CalendarContext rebuilt it and released the lock from its
    // cleanup — while the dialog was still open, and with the lock effect
    // above seeing an unchanged openId, so nothing ever re-locked (#629).
    const unlockEventRef = useRef(unlockEvent);
    useEffect(() => {
        unlockEventRef.current = unlockEvent;
    }, [unlockEvent]);

    // Release any held lock when leaving the page, and make a best-effort
    // release if the tab is closed outright. The TTL sweep is the real safety
    // net for crashes where neither fires.
    useEffect(() => {
        const releaseHeldLock = () => {
            if (lockedEventIdRef.current !== null) {
                unlockEventRef.current(lockedEventIdRef.current);
                lockedEventIdRef.current = null;
            }
        };

        window.addEventListener("beforeunload", releaseHeldLock);
        return () => {
            window.removeEventListener("beforeunload", releaseHeldLock);
            releaseHeldLock();
        };
    }, []);
}
