"use client";
import { createContext, useContext } from "react";

import { BreakWindow } from "@/api-shared/break-windows";
import { DragModifiers } from "@/components/schedule/calendar/calendar/UseDragModifiers";
import { Event, EventId } from "@/components/schedule/types/event";

/** The interaction react-big-calendar currently has in flight, if any. */
export type ActiveDrag = DragModifiers & {
    eventId: EventId;
    action: "move" | "resize";
    direction?: "DOWN" | "LEFT" | "RIGHT" | "UP";
};

/** Right-click on a tile, in viewport coordinates (#706). */
export type OpenEventContextMenu = (
    event: Event,
    clientX: number,
    clientY: number,
) => void;

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
    /**
     * Events the user has Ctrl/Cmd+clicked into a multi-selection (#706). The
     * tiles draw a selection ring for these exactly as for `selectedEventId`,
     * so a selection of many reads like a selection of one.
     */
    selectedEventIds: ReadonlySet<EventId>;
    setHoveredEventId: (eventId: EventId | null) => void;
    /**
     * `null` leaves the browser's own menu alone. The calendar always supplies
     * one: on a past iteration its write entries are disabled but Copy still
     * works, to carry an event into a writable iteration (#859).
     */
    openContextMenu: null | OpenEventContextMenu;
    /** Middle-click / Shift+click on a tile: cut the event in two at `atMs` (#657). */
    splitEventAt: (event: Event, atMs: number) => void;
    /** Right-click on empty grid opens the paste menu (#859). */
    slotContextMenuEnabled: boolean;
};

const EMPTY: SplitCalendarContextValue = {
    breakWindows: [],
    activeDrag: null,
    hoveredEventId: null,
    selectedEventId: null,
    selectedEventIds: new Set<EventId>(),
    setHoveredEventId: () => undefined,
    openContextMenu: null,
    splitEventAt: () => undefined,
    slotContextMenuEnabled: false,
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
