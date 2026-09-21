"use client";
import { useCallback, useState } from "react";

import { EventSelection } from "@/components/schedule/event-context-menu/use-event-selection";
import { Event, EventId } from "@/components/schedule/types/event";

export type ContextMenuTarget = {
    /** Viewport coordinates of the click that opened the menu. */
    position: { top: number; left: number };
    /**
     * Ids only, never the events themselves: the menu re-resolves them against
     * live state on every render, so toggling a marker with the menu still open
     * redraws its own checkmark instead of showing a snapshot taken at open.
     */
    eventIds: Array<EventId>;
};

/**
 * Owns the right-click menu's open state and decides what a right-click acts
 * on (#706): inside an existing multi-selection it adopts the whole selection,
 * anywhere else it collapses the selection onto the event that was clicked —
 * the same rule file managers and design tools use.
 * @param selection The calendar's multi-selection.
 * @returns The current target, plus open/close operations.
 */
export function useEventContextMenu(selection: EventSelection) {
    const [target, setTarget] = useState<ContextMenuTarget | null>(null);

    const openAt = useCallback(
        (event: Event, clientX: number, clientY: number) => {
            const { selectedEventIds, isSelected, selectOnly } = selection;
            const bulk = isSelected(event.id) && selectedEventIds.size > 1;

            if (!bulk) selectOnly(event.id);

            setTarget({
                position: { top: clientY, left: clientX },
                eventIds: bulk ? [...selectedEventIds] : [event.id],
            });
        },
        [selection],
    );

    const close = useCallback(() => setTarget(null), []);

    return { target, openAt, close };
}
