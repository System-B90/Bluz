import { useCallback, useReducer } from "react";

import { Event, EventId } from "@/components/schedule/types/event";

export type CalendarAction =
    | { type: "DELETE_EVENT"; payload: EventId }
    | { type: "SET_EVENTS"; payload: Array<Event> }
    | { type: "UPSERT_EVENT"; payload: Event }
    | { type: "UPSERT_MANY"; payload: Array<Event> };

type HistoryState = {
    past: Array<Array<Event>>;
    present: Array<Event>;
    future: Array<Array<Event>>;
};
type HistoryAction =
    | { type: "__local__"; action: CalendarAction }
    | { type: "__redo__" }
    | { type: "__remote__"; action: CalendarAction }
    | { type: "__undo__" };

export const calendarReducer = (
    state: Array<Event>,
    action: CalendarAction,
): Array<Event> => {
    switch (action.type) {
    case "SET_EVENTS":
        return action.payload;
    case "UPSERT_EVENT": {
        const exists = state.some((e) => e.id === action.payload.id);
        if (exists) {
            return state.map((e) =>
                e.id === action.payload.id ? action.payload : e,
            );
        }
        return [...state, action.payload];
    }
    case "UPSERT_MANY": {
        const incoming = new Map(action.payload.map((e) => [e.id, e]));
        const updated = state.map((e) => incoming.get(e.id) ?? e);
        const existingIds = new Set(state.map((e) => e.id));
        const appended = action.payload.filter((e) => !existingIds.has(e.id));
        return [...updated, ...appended];
    }
    case "DELETE_EVENT":
        return state.filter((e) => e.id !== action.payload);
    default:
        return state;
    }
};

const MAX_HISTORY = 50;

function historyReducer(
    history: HistoryState,
    histAction: HistoryAction,
): HistoryState {
    switch (histAction.type) {
    case "__local__": {
        const next = calendarReducer(history.present, histAction.action);
        if (next === history.present) return history;
        return {
            past: [
                ...history.past.slice(-MAX_HISTORY + 1),
                history.present,
            ],
            present: next,
            future: [],
        };
    }
    case "__remote__": {
        const next = calendarReducer(history.present, histAction.action);
        if (next === history.present) return history;
        return { ...history, present: next };
    }
    case "__undo__":
        if (history.past.length === 0) return history;
        return {
            past: history.past.slice(0, -1),
            present: history.past[history.past.length - 1],
            future: [history.present, ...history.future],
        };
    case "__redo__":
        if (history.future.length === 0) return history;
        return {
            past: [...history.past, history.present],
            present: history.future[0],
            future: history.future.slice(1),
        };
    }
}

export const useEventState = (initialState: Array<Event> = []) => {
    const [history, histDispatch] = useReducer(historyReducer, {
        past: [],
        present: initialState,
        future: [],
    });

    // Local dispatch — pushes to undo history (for user-initiated edits)
    const dispatch = useCallback(
        (action: CalendarAction) => {
            histDispatch({ type: "__local__", action });
        },
        [],
    );

    // Remote dispatch — updates present without touching history (for WS/server echoes)
    const remoteDispatch = useCallback(
        (action: CalendarAction) => {
            histDispatch({ type: "__remote__", action });
        },
        [],
    );

    const undo = useCallback(() => histDispatch({ type: "__undo__" }), []);
    const redo = useCallback(() => histDispatch({ type: "__redo__" }), []);

    return {
        events: history.present,
        dispatch,
        remoteDispatch,
        undo,
        redo,
    };
};
