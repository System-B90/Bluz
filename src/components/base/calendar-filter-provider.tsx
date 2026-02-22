'use client';
import { CourseId } from '@/api-shared/types/course';
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
    filteredCourses: CourseId[];
    setFilteredCourses: Dispatch<SetStateAction<Array<CourseId>>>;

    isEventFilteredOut: (event: Event) => boolean;
};

const CalendarFiltersContext = createContext<CalendarFiltersContextState | undefined>({
    default: true,
    filteredInstructors: [],
    setFilteredInstructors: () => { },
    filteredCourses: [],
    setFilteredCourses: () => { },

    isEventFilteredOut: () => false,
});

export const CalendarFiltersProvider = ({ children }: { children: React.ReactNode; }) =>
{
    const [ filteredInstructors, setFilteredInstructors ] = useState<Array<number>>([]);
    const [ filteredCourses, setFilteredCourses ] = useState<Array<CourseId>>([]);

    const isEventFilteredOut = useCallback((event: Event) =>
    {
        if (filteredInstructors.length === 0 && filteredCourses.length === 0) { return false; }

        return !event.instructors.some(instructorId => filteredInstructors.includes(instructorId));
    }, [ filteredInstructors ]);

    return (
        <CalendarFiltersContext.Provider value={ {
            default: false,
            filteredInstructors,
            setFilteredInstructors,
            filteredCourses,
            setFilteredCourses,

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
