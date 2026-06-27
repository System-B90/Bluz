"use client";

import { enqueueSnackbar } from "notistack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

export const CalendarProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const { offlineMode, captureEventBeforeEdit, captureInitialEvents } =
        useOffline();
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

    useEffect(() => {
        if (offlineMode && events.length > 0) {
            captureInitialEvents(events);
        }
    }, [offlineMode, events, captureInitialEvents]);

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

    const loadEvents = useCallback(
        (s?: Date, e?: Date) => {
            if (!s || !e) return;

            apiGetEvents({ startDate: s, endDate: e, iterationId })
                .then((fetchedEvents) => {
                    remoteDispatch({
                        type: "SET_EVENTS",
                        payload: fetchedEvents,
                    });
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

    // Force a full refetch when returning from offline mode so concurrent
    // changes made by other users while we were offline are not lost.
    const prevOfflineModeRef = useRef(offlineMode);
    useEffect(() => {
        if (prevOfflineModeRef.current && !offlineMode) {
            loadEvents(startDate, endDate);
        }
        prevOfflineModeRef.current = offlineMode;
    }, [offlineMode, loadEvents, startDate, endDate]);

    return (
        <CalendarFiltersProvider>
            <CalendarContext.Provider
                value={{
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
                }}
            >
                {children}
            </CalendarContext.Provider>
        </CalendarFiltersProvider>
    );
};
