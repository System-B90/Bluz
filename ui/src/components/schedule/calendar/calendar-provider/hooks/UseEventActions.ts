import { enqueueSnackbar } from "notistack";
import { useCallback } from "react";

import {
    apiCreateEvent,
    apiDeleteEvent,
    apiUpdateEvent,
} from "@/api-client/calendar";
import { EventChangeInitiator } from "@/api-shared/types/event-history";
import { IterationId } from "@/api-shared/types/iteration";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { createEventFactory } from "@/components/schedule/calendar/calendar-provider/EventFactory";
import { CalendarAction } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventState";
import { Event, EventId } from "@/components/schedule/types/event";
import { areEventsEqual } from "@/components/schedule/types/EventUtils";

/** What every write path says when the viewed iteration cannot be written. */
export const READ_ONLY_ITERATION_MESSAGE =
    "איטרציה קודמת מוצגת לקריאה בלבד — לא ניתן לערוך.";

export const useEventActions = (
    events: Array<Event>,
    offlineMode: boolean,
    captureEventBeforeEdit: (ev: Event) => void,
    dispatch: (action: CalendarAction) => void,
    remoteDispatch: (action: CalendarAction) => void,
    markEventCreatedLocally: (eventId: EventId) => void,
    isEventCreatedLocally: (eventId: EventId) => boolean,
    iterationScope: {
        iterationId?: IterationId;
        isReadOnlyIteration: boolean;
    } = { isReadOnlyIteration: false },
) => {
    const { iterationId, isReadOnlyIteration } = iterationScope;

    // One gate for every write path (dialog, drag, paste, split, context
    // menu, undo): a past iteration is reference material. Before this the
    // only guard was the context menu, and a paste or Ctrl+drag made while
    // viewing a past run created the event in the *current* schedule.
    const refuseIfReadOnly = useCallback((): boolean => {
        if (!isReadOnlyIteration) return false;
        enqueueSnackbar(READ_ONLY_ITERATION_MESSAGE, { variant: "warning" });
        return true;
    }, [isReadOnlyIteration]);

    const saveEvent = useCallback(
        (
            eventPartial: Partial<Event>,
            initiator: EventChangeInitiator = EventChangeInitiator.EventDialog,
        ): Event | undefined => {
            if (!eventPartial) return;
            if (refuseIfReadOnly()) return;
            if (eventPartial.name === "") {
                // A nameless event is refused, but refusing it in silence made
                // a drag or resize look like the grid was broken: the event
                // snapped back with no explanation (#612).
                enqueueSnackbar("לא ניתן לשמור אירוע ללא שם.", {
                    variant: "warning",
                });
                return;
            }

            const isNewEvent = typeof eventPartial.id === "undefined";
            // Stamp a client revision so optimistic/echo/broadcast upserts can
            // be ordered — see isStaleUpsert (#156).
            const newEvent: Event = {
                ...createEventFactory(eventPartial, isNewEvent),
                updatedAt: Date.now(),
            };

            if (offlineMode) {
                if (isNewEvent) {
                    // Tag explicitly so reconciliation can tell "created
                    // locally" apart from "modified locally" without
                    // guessing from id shape.
                    markEventCreatedLocally(newEvent.id);
                } else if (!isEventCreatedLocally(newEvent.id)) {
                    // Editing an event that was itself created offline must
                    // not demote it to "modified": reconciliation would then
                    // try to diff it against a server copy that never existed.
                    const oldEvent = events.find((ev) => ev.id === newEvent.id);
                    if (oldEvent) captureEventBeforeEdit(oldEvent);
                }
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

                apiCall(newEvent, initiator, undefined, iterationId)
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
            return newEvent;
        },
        [
            events,
            offlineMode,
            captureEventBeforeEdit,
            markEventCreatedLocally,
            isEventCreatedLocally,
            dispatch,
            remoteDispatch,
            refuseIfReadOnly,
            iterationId,
        ],
    );

    // Undo/redo apply their target snapshot to local state instantly (see
    // useEventState); this pushes the same diff to the server so a Ctrl+Z/Y
    // travel is not silently lost the moment the tab reloads or a WS echo
    // arrives. Symmetric for both directions: undo and redo are just travel
    // to a different snapshot, diffed the same way.
    const syncHistoryTravel = useCallback(
        (from: Array<Event>, to: Array<Event>) => {
            if (offlineMode || isReadOnlyIteration) return;

            const fromMap = new Map(from.map((ev) => [ev.id, ev]));
            const toMap = new Map(to.map((ev) => [ev.id, ev]));

            for (const [id, toEvent] of toMap) {
                const fromEvent = fromMap.get(id);
                if (fromEvent === toEvent) continue;

                const stamped: Event = { ...toEvent, updatedAt: Date.now() };
                const apiCall = fromEvent ? apiUpdateEvent : apiCreateEvent;
                apiCall(
                    stamped,
                    EventChangeInitiator.Undo,
                    undefined,
                    iterationId,
                ).catch((error) => {
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
                apiDeleteEvent(
                    id,
                    EventChangeInitiator.Undo,
                    undefined,
                    iterationId,
                ).catch((error) => {
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
        [offlineMode, isReadOnlyIteration, iterationId, remoteDispatch],
    );

    const deleteEvent = useCallback(
        (
            eventId: EventId,
            initiator: EventChangeInitiator = EventChangeInitiator.EventDialog,
        ) => {
            if (refuseIfReadOnly()) return;
            // Captured before the optimistic removal so a rejected delete can
            // put the event back rather than leaving the UI claiming it is gone.
            const deletedEvent = events.find((ev) => ev.id === eventId);

            dispatch({ type: "DELETE_EVENT", payload: eventId });

            if (!offlineMode) {
                apiDeleteEvent(eventId, initiator, undefined, iterationId)
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
        [
            events,
            offlineMode,
            dispatch,
            remoteDispatch,
            refuseIfReadOnly,
            iterationId,
        ],
    );

    return { saveEvent, deleteEvent, syncHistoryTravel };
};
