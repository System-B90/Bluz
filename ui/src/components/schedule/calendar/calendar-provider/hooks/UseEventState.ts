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

/**
 * Optimistic-concurrency guard (#156). Returns true when `incoming` must NOT
 * replace `existing` because it is not strictly newer. When both carry a
 * client `updatedAt` revision, only a strictly-greater revision wins; equal or
 * older revisions (a self-echo of our own save, or a stale WS broadcast that
 * raced a newer local edit) are dropped. Missing revisions on either side fall
 * back to always-overwrite for backward compatibility with legacy events.
 */
export function isStaleUpsert(existing: Event, incoming: Event): boolean {
    return (
        typeof existing.updatedAt === "number" &&
        typeof incoming.updatedAt === "number" &&
        incoming.updatedAt <= existing.updatedAt
    );
}

export const calendarReducer = (
    state: Array<Event>,
    action: CalendarAction,
): Array<Event> => {
    switch (action.type) {
    case "SET_EVENTS":
        return action.payload;
    case "UPSERT_EVENT": {
        const idx = state.findIndex((e) => e.id === action.payload.id);
        if (idx === -1) {
            return [...state, action.payload];
        }
        if (isStaleUpsert(state[idx], action.payload)) {
            // Stale/self echo — keep the newer local copy (same reference so
            // the history reducer treats it as a no-op, avoiding flicker).
            return state;
        }
        return state.map((e) =>
            e.id === action.payload.id ? action.payload : e,
        );
    }
    case "UPSERT_MANY": {
        const incoming = new Map(action.payload.map((e) => [e.id, e]));
        let changed = false;
        const updated = state.map((e) => {
            const next = incoming.get(e.id);
            if (!next || isStaleUpsert(e, next)) return e;
            changed = true;
            return next;
        });
        const existingIds = new Set(state.map((e) => e.id));
        const appended = action.payload.filter((e) => !existingIds.has(e.id));
        if (!changed && appended.length === 0) return state;
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
