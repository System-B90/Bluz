"use client";

import { enqueueSnackbar } from "notistack";
import { useCallback, useEffect, useRef, useState } from "react";

import { apiGetEvents } from "@/api-client/calendar";
import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { CalendarFiltersProvider } from "@/components/base/CalendarFilterProvider";
import { useOffline } from "@/components/base/OfflineProvider";
import { CalendarContext } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import { useEventActions } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventActions";
import { useEventState } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventState";
import { useEventWebsocket } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventWebsocket";

import "dayjs/locale/he";

export const CalendarProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const { offlineMode, captureEventBeforeEdit, captureInitialEvents } =
        useOffline();
    const [startDate, setStartDate] = useState<Date>();
    const [endDate, setEndDate] = useState<Date>();

    const { events, dispatch, remoteDispatch, undo, redo } = useEventState();

    useEffect(() => {
        if (offlineMode && events.length > 0) {
            captureInitialEvents(events);
        }
    }, [offlineMode, events, captureInitialEvents]);

    // WS updates go through remoteDispatch so they don't pollute the undo stack.
    useEventWebsocket(offlineMode, remoteDispatch);

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
                    setStartDate,
                    setEndDate,
                    saveEvent,
                    deleteEvent,
                    undo,
                    redo,
                    dispatch,
                }}
            >
                {children}
            </CalendarContext.Provider>
        </CalendarFiltersProvider>
    );
};
