'use client';

import
{
    createContext,
    Dispatch,
    SetStateAction,
    useContext,
} from 'react';

import { Event, EventId } from '@/components/schedule/types/event';

export type CalendarContextState = {
    // State
    events: Array<Event>;
    startDate: Date | undefined;
    endDate: Date | undefined;

    // Setters
    setStartDate: Dispatch<SetStateAction<Date | undefined>>;
    setEndDate: Dispatch<SetStateAction<Date | undefined>>;

    // Actions
    saveEvent: (event: Partial<Event>) => void;
    deleteEvent: (eventId: EventId) => void;
    undo: () => void;
    redo: () => void;
};

// Removed the 'default' flag hack; it's better to just type the context as potentially undefined
export const CalendarContext = createContext<CalendarContextState | undefined>(undefined);

export const useCalendar = () =>
{
    const context = useContext(CalendarContext);
    if (context === undefined)
    {
        throw new Error('useCalendar must be used within a CalendarProvider');
    }
    return context;
};
