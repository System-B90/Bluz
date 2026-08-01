"use client";
import { createContext, useContext } from "react";

import { BreakWindow } from "@/api-shared/break-windows";
import { EventId } from "@/components/schedule/types/event";

/** The interaction react-big-calendar currently has in flight, if any. */
export type ActiveDrag = {
    eventId: EventId;
    action: "move" | "resize";
    direction?: "DOWN" | "LEFT" | "RIGHT" | "UP";
};

/**
 * Shared state that makes the separate grid boxes of one split event behave as
 * a single object: hovering, selecting or dragging any piece lights up all of
 * them, and the drag preview can re-lay-out the whole event live because the
 * break windows travel with the context.
 */
export type SplitCalendarContextValue = {
    breakWindows: ReadonlyArray<BreakWindow>;
    activeDrag: ActiveDrag | null;
    hoveredEventId: EventId | null;
    selectedEventId: EventId | null;
    setHoveredEventId: (eventId: EventId | null) => void;
};

const EMPTY: SplitCalendarContextValue = {
    breakWindows: [],
    activeDrag: null,
    hoveredEventId: null,
    selectedEventId: null,
    setHoveredEventId: () => undefined,
};

const SplitCalendarContext = createContext<SplitCalendarContextValue>(EMPTY);

export const SplitCalendarProvider = SplitCalendarContext.Provider;

/**
 * Reads the split-calendar interaction state. Falls back to inert defaults
 * outside a provider so the event component stays renderable in isolation.
 */
export function useSplitCalendar(): SplitCalendarContextValue {
    return useContext(SplitCalendarContext);
}
