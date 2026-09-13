"use client";

import { createContext, Dispatch, SetStateAction, useContext } from "react";

import { EventLockMessage } from "@/api-shared/types";
import { EventChangeInitiator } from "@/api-shared/types/event-history";
import { IterationId } from "@/api-shared/types/iteration";
import { CalendarAction } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventState";
import { Event, EventId } from "@/components/schedule/types/event";

export type CalendarContextState = {
    // State
    events: Array<Event>;
    startDate: Date | undefined;
    endDate: Date | undefined;

    // Active iteration being viewed. `undefined` ⇒ the current (writable) run.
    // A past iteration is read-only reference material.
    iterationId: IterationId | undefined;
    // True when viewing a past iteration (writes are rejected server-side).
    isReadOnlyIteration: boolean;

    // True only until the first event fetch settles — the window in which the
    // grid would otherwise render blank and read as broken.
    isLoadingEvents: boolean;

    // Period locking: maps eventId → lock info for events currently being edited by any user
    eventLocks: Record<EventId, EventLockMessage>;

    // Setters
    setStartDate: Dispatch<SetStateAction<Date | undefined>>;
    setEndDate: Dispatch<SetStateAction<Date | undefined>>;
    setIterationId: Dispatch<SetStateAction<IterationId | undefined>>;

    // Actions
    /**
     * Persists an event. `initiator` names the user action behind the write so
     * the server can log it (see api-shared/types/event-history.ts); it
     * defaults to an event-dialog edit.
     */
    saveEvent: (event: Partial<Event>, initiator?: EventChangeInitiator) => Event | undefined;
    deleteEvent: (eventId: EventId, initiator?: EventChangeInitiator) => void;
    undo: () => void;
    redo: () => void;
    dispatch: (action: CalendarAction) => void;

    // Period locking actions (called by EventDialog on open/close)
    lockEvent: (eventId: EventId) => void;
    unlockEvent: (eventId: EventId) => void;
};

export const CalendarContext = createContext<CalendarContextState | undefined>(
    undefined,
);

export const useCalendar = () => {
    const context = useContext(CalendarContext);
    if (context === undefined) {
        throw new Error("useCalendar must be used within a CalendarProvider");
    }
    return context;
};
