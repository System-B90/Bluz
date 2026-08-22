import { enqueueSnackbar } from "notistack";
import { useCallback } from "react";

import {
    apiCreateEvent,
    apiDeleteEvent,
    apiUpdateEvent,
} from "@/api-client/calendar";
import { EventChangeInitiator } from "@/api-shared/types/event-history";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
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
        (
            eventPartial: Partial<Event>,
            initiator: EventChangeInitiator = EventChangeInitiator.EventDialog,
        ) => {
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

            // Kept for the rollback below: if the server refuses the write, the
            // optimistic copy has to go back to what the server still holds,
            // otherwise the calendar shows an edit that was never persisted.
            const previousEvent = isNewEvent
                ? undefined
                : events.find((ev) => ev.id === newEvent.id);

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

                apiCall(newEvent, initiator)
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
                        // Undo the optimistic write. A failed creation is
                        // dropped; a failed update goes back to the version we
                        // replaced (nothing to restore to if it was not in
                        // local state, in which case dropping it is right).
                        if (isNewEvent) {
                            remoteDispatch({
                                type: "DELETE_EVENT",
                                payload: newEvent.id,
                            });
                        } else if (previousEvent) {
                            remoteDispatch({
                                type: "UPSERT_EVENT",
                                payload: {
                                    ...previousEvent,
                                    updatedAt: Math.max(
                                        Date.now(),
                                        (newEvent.updatedAt ?? 0) + 1,
                                    ),
                                },
                            });
                        }
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

    // Undo/redo apply their target snapshot to local state instantly (see
    // useEventState); this pushes the same diff to the server so a Ctrl+Z/Y
    // travel is not silently lost the moment the tab reloads or a WS echo
    // arrives. Symmetric for both directions: undo and redo are just travel
    // to a different snapshot, diffed the same way.
    const syncHistoryTravel = useCallback(
        (from: Array<Event>, to: Array<Event>) => {
            if (offlineMode) return;

            const fromMap = new Map(from.map((ev) => [ev.id, ev]));
            const toMap = new Map(to.map((ev) => [ev.id, ev]));

            for (const [id, toEvent] of toMap) {
                const fromEvent = fromMap.get(id);
                if (fromEvent === toEvent) continue;

                const stamped: Event = { ...toEvent, updatedAt: Date.now() };
                const apiCall = fromEvent ? apiUpdateEvent : apiCreateEvent;
                apiCall(stamped, EventChangeInitiator.Undo).catch((error) => {
                    // Roll the local copy back to what the server still holds.
                    remoteDispatch(
                        fromEvent
                            ? {
                                type: "UPSERT_EVENT",
                                payload: { ...fromEvent, updatedAt: Date.now() },
                            }
                            : { type: "DELETE_EVENT", payload: id },
                    );
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "סנכרון ביטול הפעולה נכשל!",
                        error,
                    );
                });
            }

            for (const [id, fromEvent] of fromMap) {
                if (toMap.has(id)) continue;
                apiDeleteEvent(id, EventChangeInitiator.Undo).catch((error) => {
                    remoteDispatch({
                        type: "UPSERT_EVENT",
                        payload: { ...fromEvent, updatedAt: Date.now() },
                    });
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "סנכרון ביטול הפעולה נכשל!",
                        error,
                    );
                });
            }
        },
        [offlineMode, remoteDispatch],
    );

    const deleteEvent = useCallback(
        (
            eventId: EventId,
            initiator: EventChangeInitiator = EventChangeInitiator.EventDialog,
        ) => {
            // Captured before the optimistic removal so a rejected delete can
            // put the event back rather than leaving the UI claiming it is gone.
            const deletedEvent = events.find((ev) => ev.id === eventId);

            dispatch({ type: "DELETE_EVENT", payload: eventId });

            if (!offlineMode) {
                apiDeleteEvent(eventId, initiator)
                    .then(() =>
                        enqueueSnackbar("המופע נמחק בהצלחה.", {
                            variant: "success",
                        }),
                    )
                    .catch((error) => {
                        if (deletedEvent) {
                            remoteDispatch({
                                type: "UPSERT_EVENT",
                                payload: {
                                    ...deletedEvent,
                                    updatedAt: Date.now(),
                                },
                            });
                        }
                        enqueueApiErrorSnackbar(
                            enqueueSnackbar,
                            "מחיקת המופע נכשלה!",
                            error,
                        );
                    });
            }
        },
        [events, offlineMode, dispatch, remoteDispatch],
    );

    return { saveEvent, deleteEvent, syncHistoryTravel };
};
