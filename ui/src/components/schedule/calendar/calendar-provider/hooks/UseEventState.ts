import { useHistoryState } from "@uidotdev/usehooks";
import { useCallback, useEffect, useRef } from "react";

import { Event, EventId } from "@/components/schedule/types/event";

export type CalendarAction =
  | { type: "DELETE_EVENT"; payload: EventId }
  | { type: "SET_EVENTS"; payload: Array<Event> }
  | { type: "UPSERT_EVENT"; payload: Event }
  | { type: "UPSERT_MANY"; payload: Array<Event> };

export const calendarReducer = (
    state: Array<Event>,
    action: CalendarAction,
): Array<Event> => {
    switch (action.type) {
    case "SET_EVENTS":
        return action.payload;
    case "UPSERT_EVENT":
        return [
            ...state.filter((e) => e.id !== action.payload.id),
            action.payload,
        ];
    case "UPSERT_MANY": {
        const newIds = new Set(action.payload.map((e) => e.id));
        return [...state.filter((e) => !newIds.has(e.id)), ...action.payload];
    }
    case "DELETE_EVENT":
        return state.filter((e) => e.id !== action.payload);
    default:
        return state;
    }
};

export const useEventState = (initialState: Array<Event> = []) => {
    const {
        state: events,
        set: setEvents,
        undo,
        redo,
    } = useHistoryState<Array<Event>>(initialState);

    const eventsRef = useRef<Array<Event>>(events);

    useEffect(() => {
        eventsRef.current = events;
    }, [events]);

    const dispatch = useCallback(
        (action: CalendarAction) => {
            const nextState = calendarReducer(eventsRef.current, action);
            setEvents(nextState);
        },
        [setEvents],
    );

    return { events, dispatch, undo, redo };
};
