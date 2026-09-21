"use client";
import { useCallback, useMemo, useState } from "react";

import { Event, EventId } from "@/components/schedule/types/event";

export type EventSelection = {
    /** Ids the user has explicitly multi-selected (Ctrl/Cmd+click). */
    selectedEventIds: ReadonlySet<EventId>;
    isSelected: (eventId: EventId) => boolean;
    /** Collapses the selection down to this one event. */
    selectOnly: (eventId: EventId) => void;
    /** Ctrl/Cmd+click: adds or removes one event without disturbing the rest. */
    toggle: (eventId: EventId) => void;
    clear: () => void;
    /**
     * The selected events, in calendar order, resolved against the live event
     * list. Ids whose event is gone (deleted here or by another user) drop out
     * rather than being handed to an action that would then fail server-side.
     */
    selectedEvents: Array<Event>;
};

/**
 * Multi-selection of calendar tiles (#706). Held above the calendar because
 * both the grid (which draws the selection ring) and the right-click menu
 * (which acts on it in bulk) read it.
 * @param events The events currently loaded into the calendar.
 * @returns The selection and the operations that mutate it.
 */
export function useEventSelection(events: Array<Event>): EventSelection {
    const [selectedEventIds, setSelectedEventIds] = useState<ReadonlySet<EventId>>(
        () => new Set(),
    );

    const isSelected = useCallback(
        (eventId: EventId) => selectedEventIds.has(eventId),
        [selectedEventIds],
    );

    const selectOnly = useCallback(
        (eventId: EventId) => setSelectedEventIds(new Set([eventId])),
        [],
    );

    const toggle = useCallback((eventId: EventId) => {
        setSelectedEventIds((previous) => {
            const next = new Set(previous);
            if (!next.delete(eventId)) next.add(eventId);
            return next;
        });
    }, []);

    const clear = useCallback(() => {
        // Skip the state write when there is nothing selected: a plain click on
        // empty grid fires this on every slot select, and a fresh empty Set
        // each time re-renders every tile for no reason.
        setSelectedEventIds((previous) =>
            previous.size === 0 ? previous : new Set(),
        );
    }, []);

    const selectedEvents = useMemo(
        () => events.filter((event) => selectedEventIds.has(event.id)),
        [events, selectedEventIds],
    );

    return useMemo(
        () => ({
            selectedEventIds,
            isSelected,
            selectOnly,
            toggle,
            clear,
            selectedEvents,
        }),
        [selectedEventIds, isSelected, selectOnly, toggle, clear, selectedEvents],
    );
}
