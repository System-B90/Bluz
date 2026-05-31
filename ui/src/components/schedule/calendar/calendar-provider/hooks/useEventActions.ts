import { enqueueSnackbar } from "notistack";
import { useCallback } from "react";

import { apiCreateEvent, apiDeleteEvent, apiUpdateEvent } from "@/api-client/calendar";
import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { createEventFactory } from "@/components/schedule/calendar/calendar-provider/eventFactory";
import { CalendarAction } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventState";
import { Event, EventId } from "@/components/schedule/types/event";

export const useEventActions = (
    events: Array<Event>,
    offlineMode: boolean,
    captureEventBeforeEdit: (ev: Event) => void,
    dispatch: (action: CalendarAction) => void
) =>
{
    const saveEvent = useCallback(
        (eventPartial: Partial<Event>) =>
        {
            if (!eventPartial || eventPartial.name === "") return;

            const isNewEvent = typeof eventPartial.id === "undefined";
            const newEvent = createEventFactory(eventPartial, isNewEvent);

            if (!isNewEvent && offlineMode)
            {
                const oldEvent = events.find((ev) => ev.id === newEvent.id);
                if (oldEvent) captureEventBeforeEdit(oldEvent);
            }

            dispatch({ type: "UPSERT_EVENT", payload: newEvent });

            if (!offlineMode)
            {
                const apiCall = isNewEvent ? apiCreateEvent : apiUpdateEvent;
                const successMsg = isNewEvent ? `המופע "${newEvent.name}" נוצר בהצלחה!` : `המופע "${newEvent.name}" נשמר בהצלחה!`;
                const errorMsg = isNewEvent ? "יצירת המופע נכשלה!" : "שמירת המופע נכשלה!";

                apiCall(newEvent)
                    .then((res) =>
                    {
                        enqueueSnackbar(successMsg, { variant: "success" });
                        dispatch({ type: "UPSERT_EVENT", payload: res });
                    })
                    .catch((error) =>
                    {
                        enqueueApiErrorSnackbar(enqueueSnackbar, errorMsg, error);
                    });
            }
        },
        [ events, offlineMode, captureEventBeforeEdit, dispatch ]
    );

    const deleteEvent = useCallback(
        (eventId: EventId) =>
        {
            dispatch({ type: "DELETE_EVENT", payload: eventId });

            if (!offlineMode)
            {
                apiDeleteEvent(eventId)
                    .then(() => enqueueSnackbar("המופע נמחק בהצלחה.", { variant: "success" }))
                    .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, "מחיקת המופע נכשלה!", error));
            }
        },
        [ offlineMode, dispatch ]
    );

    return { saveEvent, deleteEvent };
};
