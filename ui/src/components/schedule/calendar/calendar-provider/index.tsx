"use client";

import { enqueueSnackbar } from "notistack";
import { useCallback, useEffect, useRef, useState } from "react";

import { apiGetEvents } from "@/api-client/calendar";
import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { EventLockMessage } from "@/api-shared/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { CalendarFiltersProvider } from "@/components/base/CalendarFilterProvider";
import { useOffline } from "@/components/base/OfflineProvider";
import { CalendarContext } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import { useEventActions } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventActions";
import { useEventState } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventState";
import { useEventWebsocket } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventWebsocket";
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
    const [eventLocks, setEventLocks] = useState<
        Record<EventId, EventLockMessage>
    >({});

    const { events, dispatch, remoteDispatch, undo, redo } = useEventState();

    useEffect(() => {
        if (offlineMode && events.length > 0) {
            captureInitialEvents(events);
        }
    }, [offlineMode, events, captureInitialEvents]);

    const setEventLock = useCallback(
        (eventId: EventId, lock: EventLockMessage | null) => {
            // Ignore our own lock echoes — we know what we're editing.
            if (lock !== null && lock.lockedById === userData.id) return;

            setEventLocks((prev) => {
                const next = { ...prev };
                if (lock === null) {
                    delete next[eventId];
                } else {
                    next[eventId] = lock;
                }
                return next;
            });
        },
        [userData.id],
    );

    // Broadcast that we have opened an event for editing so other clients can
    // show a "dirty" indicator. Relayed through the session server (ephemeral).
    const lockEvent = useCallback(
        (eventId: EventId) => {
            sendMessage({
                type: MessageTypes.EVENT_LOCK,
                data: {
                    eventId,
                    lockedById: userData.id,
                    lockedByName: userData.display_name || userData.name,
                },
            });
        },
        [sendMessage, userData.id, userData.display_name, userData.name],
    );

    const unlockEvent = useCallback(
        (eventId: EventId) => {
            sendMessage({
                type: MessageTypes.EVENT_UNLOCK,
                data: { eventId },
            });
        },
        [sendMessage],
    );

    // WS updates go through remoteDispatch so they don't pollute the undo stack.
    useEventWebsocket(offlineMode, remoteDispatch, setEventLock);

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

            apiGetEvents({ startDate: s, endDate: e })
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
        [remoteDispatch],
    );

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
                    eventLocks,
                    setStartDate,
                    setEndDate,
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
