'use client';
import { Event } from '@/components/schedule/types/event';
import
{
    createContext,
    Dispatch,
    SetStateAction,
    useCallback,
    useContext,
    useState,
} from 'react';

export type CalendarFiltersContextState = {
    default: boolean;
    filteredInstructors: number[];
    setFilteredInstructors: Dispatch<SetStateAction<Array<number>>>;

    isEventFilteredOut: (event: Event) => boolean;
};

const CalendarFiltersContext = createContext<CalendarFiltersContextState | undefined>({
    default: true,
    filteredInstructors: [],
    setFilteredInstructors: () => { },

    isEventFilteredOut: () => false,
});

export const CalendarFiltersProvider = ({ children }: { children: React.ReactNode; }) =>
{
    const [ filteredInstructors, setFilteredInstructors ] = useState<Array<number>>([]);

    const isEventFilteredOut = useCallback((event: Event) =>
    {
        if (filteredInstructors.length === 0) { return false; }

        return !event.instructors.some(instructorId => filteredInstructors.includes(instructorId));
    }, [ filteredInstructors ]);

    return (
        <CalendarFiltersContext.Provider value={ {
            default: false,
            filteredInstructors,
            setFilteredInstructors,

            isEventFilteredOut
        } }>
            { children }
        </CalendarFiltersContext.Provider>
    );
};

export const useCalendarFilters = () =>
{
    const context = useContext(CalendarFiltersContext);

    if (context === undefined || context.default)
    {
        throw new Error('useCalendarFilters must be used within an CalendarFiltersProvider');
    }

    return context;
};
