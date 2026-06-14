"use client";

import { enqueueSnackbar } from "notistack";
import { useCallback, useEffect, useState } from "react";

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

    const { events, dispatch, undo, redo } = useEventState();

    useEffect(() => {
        if (offlineMode && events.length > 0) {
            captureInitialEvents(events);
        }
    }, [offlineMode, events, captureInitialEvents]);

    useEventWebsocket(offlineMode, dispatch);

    const { saveEvent, deleteEvent } = useEventActions(
        events,
        offlineMode,
        captureEventBeforeEdit,
        dispatch,
    );

    const loadEvents = useCallback(
        (s?: Date, e?: Date) => {
            if (!s || !e) return;

            apiGetEvents({ startDate: s, endDate: e })
                .then((fetchedEvents) => {
                    dispatch({ type: "SET_EVENTS", payload: fetchedEvents });
                })
                .catch((error) =>
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        'טעינת לו"ז נכשלה.',
                        error,
                    ),
                );
        },
        [dispatch],
    );

    useEffect(() => {
        loadEvents(startDate, endDate);
    }, [startDate, endDate, loadEvents]);

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
