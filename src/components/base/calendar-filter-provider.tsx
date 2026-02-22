'use client';
import { PotentialPA } from '@/api-shared/types';
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
    showPAsFor: number | null;
    setShowPAsFor: Dispatch<SetStateAction<number | null>>;

    eventFilteredOpacity: (event: Event) => number;
};

const CalendarFiltersContext = createContext<CalendarFiltersContextState | undefined>({
    default: true,
    filteredInstructors: [],
    setFilteredInstructors: () => { },
    filteredCourses: [],
    setFilteredCourses: () => { },
    showPAsFor: null,
    setShowPAsFor: () => null,

    eventFilteredOpacity: () => 1,
});

export function isInstructorBusy(instructor: number, event: Event): boolean
{
    const isLecturer = event.lecturers?.includes(instructor) ?? false;
    return event.instructors.includes(instructor) || isLecturer;
}

export const CalendarFiltersProvider = ({ children }: { children: React.ReactNode; }) =>
{
    const [ showPAsFor, setShowPAsFor ] = useState<number | null>(null /** ID of instructor */); // פ"א
    const [ filteredInstructors, setFilteredInstructors ] = useState<Array<number>>([]);
    const [ filteredCourses, setFilteredCourses ] = useState<Array<CourseId>>([]);

    const eventFilteredOpacity = useCallback((event: Event): number =>
    {

        // Quick no filter exit check
        if (filteredInstructors.length === 0 && filteredCourses.length === 0 && showPAsFor === null) { return 1; }

        const hasMatchingCourse = filteredCourses.length === 0 || event.courses.length === 0 || event.courses.some(courseId => filteredCourses.includes(courseId));
        if (showPAsFor === null)
        {
            const hasMatchingInstructor = [ ...event.instructors, ...event.lecturers?.filter((v) => typeof v === 'number') ?? [] ].some(instructorId => filteredInstructors.includes(instructorId));

            return (hasMatchingInstructor || hasMatchingCourse) ? 1 : 0.2;
        }

        // showPAsFor !== null

        if (!hasMatchingCourse) { return 0; }
        let paState: PotentialPA = event.personalTalk ? PotentialPA.YesRecommended : (event.required ? PotentialPA.No : PotentialPA.YesNotRecommended);
        if (paState === PotentialPA.YesRecommended)
        {
            // Check if busy
            if (isInstructorBusy(showPAsFor, event))
            {
                paState = PotentialPA.NoRecommendedButBusy;
            }
        }

        switch (paState)
        {
            case PotentialPA.YesRecommended:
                return 1;
            case PotentialPA.YesNotRecommended:
                return 0.4;
            case PotentialPA.No:
                return 0.1;
            case PotentialPA.NoRecommendedButBusy:
                return 0.3;
        }

        return 1;
    }, [ filteredInstructors, filteredCourses, showPAsFor ]);

    return (
        <CalendarFiltersContext.Provider value={ {
            default: false,
            filteredInstructors,
            setFilteredInstructors,
            filteredCourses,
            setFilteredCourses,
            showPAsFor,
            setShowPAsFor,

            eventFilteredOpacity
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
