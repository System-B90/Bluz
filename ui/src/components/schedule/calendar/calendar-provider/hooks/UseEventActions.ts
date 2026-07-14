import { enqueueSnackbar } from "notistack";
import { useCallback } from "react";

import {
    apiCreateEvent,
    apiDeleteEvent,
    apiUpdateEvent,
} from "@/api-client/calendar";
import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { createEventFactory } from "@/components/schedule/calendar/calendar-provider/EventFactory";
import { CalendarAction } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventState";
import { Event, EventId } from "@/components/schedule/types/event";
import { areEventsEqual } from "@/components/schedule/types/EventUtils";

export const useEventActions = (
    events: Array<Event>,
    offlineMode: boolean,
    captureEventBeforeEdit: (ev: Event) => void,
    dispatch: (action: CalendarAction) => void,
    remoteDispatch: (action: CalendarAction) => void,
) => {
    const saveEvent = useCallback(
        (eventPartial: Partial<Event>) => {
            if (!eventPartial || eventPartial.name === "") return;

            const isNewEvent = typeof eventPartial.id === "undefined";
            // Stamp a client revision so optimistic/echo/broadcast upserts can
            // be ordered — see isStaleUpsert (#156).
            const newEvent: Event = {
                ...createEventFactory(eventPartial, isNewEvent),
                updatedAt: Date.now(),
            };

            if (!isNewEvent && offlineMode) {
                const oldEvent = events.find((ev) => ev.id === newEvent.id);
                if (oldEvent) captureEventBeforeEdit(oldEvent);
            }

            // Optimistic local update — pushed to undo history
            dispatch({ type: "UPSERT_EVENT", payload: newEvent });

            if (!offlineMode) {
                const apiCall = isNewEvent ? apiCreateEvent : apiUpdateEvent;
                const successMsg = isNewEvent
                    ? `המופע "${newEvent.name}" נוצר בהצלחה!`
                    : `המופע "${newEvent.name}" נשמר בהצלחה!`;
                const errorMsg = isNewEvent
                    ? "יצירת המופע נכשלה!"
                    : "שמירת המופע נכשלה!";

                apiCall(newEvent)
                    .then((res) => {
                        enqueueSnackbar(successMsg, { variant: "success" });
                        // Server confirmation. Skip the redundant re-upsert when
                        // the server echoed back exactly what we optimistically
                        // applied — re-dispatching identical data just churns
                        // references and flickers the calendar (#156). Any real
                        // server-side normalization still flows through.
                        if (!areEventsEqual(res, newEvent)) {
                            remoteDispatch({
                                type: "UPSERT_EVENT",
                                // Strictly-newer revision so the authoritative
                                // server version wins over both the optimistic
                                // copy and the (older) self WS echo.
                                payload: {
                                    ...res,
                                    updatedAt: Math.max(
                                        Date.now(),
                                        (newEvent.updatedAt ?? 0) + 1,
                                    ),
                                },
                            });
                        }
                    })
                    .catch((error) => {
                        enqueueApiErrorSnackbar(
                            enqueueSnackbar,
                            errorMsg,
                            error,
                        );
                    });
            }
        },
        [events, offlineMode, captureEventBeforeEdit, dispatch, remoteDispatch],
    );

    const deleteEvent = useCallback(
        (eventId: EventId) => {
            dispatch({ type: "DELETE_EVENT", payload: eventId });

            if (!offlineMode) {
                apiDeleteEvent(eventId)
                    .then(() =>
                        enqueueSnackbar("המופע נמחק בהצלחה.", {
                            variant: "success",
                        }),
                    )
                    .catch((error) =>
                        enqueueApiErrorSnackbar(
                            enqueueSnackbar,
                            "מחיקת המופע נכשלה!",
                            error,
                        ),
                    );
            }
        },
        [offlineMode, dispatch],
    );

    return { saveEvent, deleteEvent };
};
