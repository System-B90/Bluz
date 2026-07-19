"use client";

import { enqueueSnackbar } from "notistack";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { apiGetEvents } from "@/api-client/calendar";
import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { EventLockMessage } from "@/api-shared/types";
import { IterationId } from "@/api-shared/types/iteration";
import { useAuth } from "@/components/auth/AuthProvider";
import { CalendarFiltersProvider } from "@/components/base/CalendarFilterProvider";
import { useOffline } from "@/components/base/OfflineProvider";
import { CalendarContext } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import { useEventActions } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventActions";
import { useEventState } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventState";
import { useEventWebsocket } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventWebsocket";
import {
    applyLockUpdate,
    LOCK_SWEEP_MS,
    LockState,
    pruneExpiredLocks,
    toPublicLocks,
} from "@/components/schedule/calendar/calendar-provider/lock-state";
import { EventId } from "@/components/schedule/types/event";
import { MessageTypes } from "@/settings";

import "dayjs/locale/he";

/** Provides calendar event state, offline support, undo/redo, and live presence locks to child components. */
export const CalendarProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const {
        offlineMode,
        pushDialogOpen,
        captureEventBeforeEdit,
        captureInitialEvents,
    } = useOffline();
    const { userData, sendMessage } = useAuth();
    const [startDate, setStartDate] = useState<Date>();
    const [endDate, setEndDate] = useState<Date>();
    // Active iteration. `undefined` ⇒ the current (writable) run.
    const [iterationId, setIterationId] = useState<IterationId | undefined>(
        undefined,
    );
    // Internal lock state carries per-lock expiry; the public `eventLocks` map
    // (below) strips that bookkeeping for consumers.
    const [lockState, setLockState] = useState<LockState>({});

    const { events, dispatch, remoteDispatch, undo, redo } = useEventState();

    const offlineModeRef = useRef(offlineMode);

    // Keep ref in sync after every render without triggering re-renders.
    useLayoutEffect(() => {
        offlineModeRef.current = offlineMode;
    });

    // Tracks whether we've already taken the offline snapshot for this session.
    // Reset when leaving offline mode so the next entry gets a fresh capture.
    const didCaptureOfflineRef = useRef(false);

    // Captures the events snapshot as soon as offline mode is entered — even if
    // still empty (e.g. the initial fetch hasn't resolved yet). `loadEvents`
    // skips its SET_EVENTS dispatch entirely while offline, so no legitimate
    // baseline batch can arrive later; waiting for a "first non-empty batch"
    // instead let events created *after* going offline (while the initial
    // fetch was still in flight) be mistaken for pre-existing ones, hiding
    // them from the offline-changes diff entirely.
    useEffect(() => {
        if (!offlineMode) {
            didCaptureOfflineRef.current = false;
            return;
        }
        if (!didCaptureOfflineRef.current) {
            captureInitialEvents(events);
            didCaptureOfflineRef.current = true;
        }
    }, [offlineMode, events, captureInitialEvents]);

    /** Applies a lock or unlock update for a single event into the lock state map. */
    const setEventLock = useCallback(
        (eventId: EventId, lock: EventLockMessage | null) => {
            setLockState((prev) =>
                applyLockUpdate(prev, eventId, lock, {
                    selfId: userData.id,
                    now: Date.now(),
                }),
            );
        },
        [userData.id],
    );

    // Self-healing presence: prune locks whose heartbeat has lapsed. This clears
    // locks left behind by clients that crashed or disconnected without sending
    // an explicit unlock.
    useEffect(() => {
        const interval = setInterval(() => {
            setLockState((prev) => pruneExpiredLocks(prev, Date.now()));
        }, LOCK_SWEEP_MS);
        return () => clearInterval(interval);
    }, []);

    const eventLocks = useMemo(() => toPublicLocks(lockState), [lockState]);

    // Broadcast that we have opened an event for editing so other clients can
    // show a "dirty" indicator. Relayed through the session server (ephemeral).
    // Re-emitting this on a heartbeat both refreshes the TTL on existing
    // listeners and informs clients that connected after the lock was taken.
    /** Broadcasts an EVENT_LOCK message so other clients show a presence indicator on the event. */
    const lockEvent = useCallback(
        (eventId: EventId) => {
            sendMessage({
                type: MessageTypes.EVENT_LOCK,
                data: {
                    eventId,
                    lockedById: userData.id,
                    lockedByName: userData.display_name || userData.name,
                    iterationId,
                },
            });
        },
        [sendMessage, userData.id, userData.display_name, userData.name, iterationId],
    );

    /** Broadcasts an EVENT_UNLOCK message to release the presence lock on the event. */
    const unlockEvent = useCallback(
        (eventId: EventId) => {
            sendMessage({
                type: MessageTypes.EVENT_UNLOCK,
                data: { eventId, iterationId },
            });
        },
        [sendMessage, iterationId],
    );

    // WS updates go through remoteDispatch so they don't pollute the undo stack.
    // Pass the active iteration so broadcasts for other iterations are ignored.
    useEventWebsocket(offlineMode, remoteDispatch, setEventLock, iterationId);

    const { saveEvent, deleteEvent } = useEventActions(
        events,
        offlineMode,
        captureEventBeforeEdit,
        dispatch,
        remoteDispatch,
    );

    /** Fetches events for the given date range and dispatches them remotely; skips dispatch when offline. */
    const loadEvents = useCallback(
        (s?: Date, e?: Date) => {
            if (!s || !e) return;

            apiGetEvents({ startDate: s, endDate: e, iterationId })
                .then((fetchedEvents) => {
                    if (!offlineModeRef.current) {
                        remoteDispatch({
                            type: "SET_EVENTS",
                            payload: fetchedEvents,
                        });
                    }
                })
                .catch((error) =>
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        'טעינת לו"ז נכשלה.',
                        error,
                    ),
                );
        },
        [remoteDispatch, iterationId],
    );

    // Reload when the date range or the active iteration changes.
    useEffect(() => {
        loadEvents(startDate, endDate);
    }, [startDate, endDate, loadEvents]);

    // Force a full refetch to pull in concurrent changes made by other users
    // while we were offline. This must wait until the offline reconciliation
    // dialog has been *resolved* (closed while back online): refetching on the
    // raw offline→online transition races the dialog and overwrites the user's
    // local edits with the server state before they can review them — the
    // dialog then sees no diffs, closes itself, and silently discards the work.
    const prevPushDialogOpenRef = useRef(pushDialogOpen);
    useEffect(() => {
        if (prevPushDialogOpenRef.current && !pushDialogOpen && !offlineMode) {
            loadEvents(startDate, endDate);
        }
        prevPushDialogOpenRef.current = pushDialogOpen;
    }, [pushDialogOpen, offlineMode, loadEvents, startDate, endDate]);

    const contextValue = useMemo(
        () => ({
            events,
            startDate,
            endDate,
            iterationId,
            isReadOnlyIteration: Boolean(iterationId),
            eventLocks,
            setStartDate,
            setEndDate,
            setIterationId,
            saveEvent,
            deleteEvent,
            undo,
            redo,
            dispatch,
            lockEvent,
            unlockEvent,
        }),
        [
            events,
            startDate,
            endDate,
            iterationId,
            eventLocks,
            setStartDate,
            setEndDate,
            setIterationId,
            saveEvent,
            deleteEvent,
            undo,
            redo,
            dispatch,
            lockEvent,
            unlockEvent,
        ],
    );

    return (
        <CalendarFiltersProvider>
            <CalendarContext.Provider value={contextValue}>
                {children}
            </CalendarContext.Provider>
        </CalendarFiltersProvider>
    );
};
