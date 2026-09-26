"use client";
import {
    createContext,
    Dispatch,
    SetStateAction,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";

import { PotentialPA } from "@/api-shared/types";
import { CourseId } from "@/api-shared/types/course";
import { roomLikeToResourceKey } from "@/api-shared/types/room";
import { useCourses } from "@/components/base/CoursesProvider";
import { Event, EventType } from "@/components/schedule/types/event";

export type CalendarFiltersContextState = {
    default: boolean;
    filteredInstructors: Array<number>;
    setFilteredInstructors: Dispatch<SetStateAction<Array<number>>>;
    filteredCourses: Array<CourseId>;
    setFilteredCourses: Dispatch<SetStateAction<Array<CourseId>>>;
    showPAsFor: null | number;
    setShowPAsFor: Dispatch<SetStateAction<null | number>>;
    filteredRoom: null | string;
    setFilteredRoom: Dispatch<SetStateAction<null | string>>;
    hidePrayers: boolean;
    setHidePrayers: Dispatch<SetStateAction<boolean>>;
    showMisconfigurations: boolean;
    setShowMisconfigurations: Dispatch<SetStateAction<boolean>>;

    eventFilteredOpacity: (event: Event) => number;

    /** True when any filter is narrowing the calendar. */
    hasActiveFilters: boolean;
    /** Resets every filter to its default, showing the full calendar again. */
    clearFilters: () => void;
};

const CalendarFiltersContext = createContext<
    CalendarFiltersContextState | undefined
>({
    default: true,
    filteredInstructors: [],
    setFilteredInstructors: () => {},
    filteredCourses: [],
    setFilteredCourses: () => {},
    showPAsFor: null,
    setShowPAsFor: () => {},
    filteredRoom: null,
    setFilteredRoom: () => {},
    hidePrayers: false,
    setHidePrayers: () => {},
    showMisconfigurations: true,
    setShowMisconfigurations: () => {},

    eventFilteredOpacity: () => 1,
    hasActiveFilters: false,
    clearFilters: () => {},
});

export function isInstructorBusy(instructor: number, event: Event): boolean {
    const isLecturer = event.lecturers?.includes(instructor) ?? false;
    return event.instructors.includes(instructor) || isLecturer;
}

export const CalendarFiltersProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const [hidePrayers, setHidePrayers] = useState<boolean>(false);
    const [showMisconfigurations, setShowMisconfigurations] =
        useState<boolean>(true);
    const [showPAsFor, setShowPAsFor] = useState<null | number>(
        null /** ID of instructor */,
    ); // פ"א
    const [filteredInstructors, setFilteredInstructors] = useState<
        Array<number>
    >([]);
    const [filteredCourses, setFilteredCourses] = useState<Array<CourseId>>([]);
    const [filteredRoom, setFilteredRoom] = useState<null | string>(null);
    const { courses } = useCourses();

    // Selecting a course also matches events of all its descendants.
    // Expanded at match time (not stored), so deselecting a parent
    // drops the children it pulled in.
    const matchedCourses = useMemo(() => {
        if (filteredCourses.length === 0) return new Set<CourseId>();
        const childrenOf = new Map<CourseId, Array<CourseId>>();
        for (const course of courses) {
            if (!course.parentId) continue;
            const siblings = childrenOf.get(course.parentId) ?? [];
            siblings.push(course.id);
            childrenOf.set(course.parentId, siblings);
        }
        const matched = new Set<CourseId>();
        const stack = [...filteredCourses];
        while (stack.length > 0) {
            const id = stack.pop()!;
            if (matched.has(id)) continue;
            matched.add(id);
            stack.push(...(childrenOf.get(id) ?? []));
        }
        return matched;
    }, [courses, filteredCourses]);

    const eventFilteredOpacity = useCallback(
        (event: Event): number => {
            // Desirec behaviour is that if hidePrayers is on, prayers should simply not exist on the calendar
            if (event.type === EventType.PRAYER && hidePrayers) {
                return 0;
            }

            if (
                filteredRoom !== null &&
                !event.rooms.some(
                    (room) => roomLikeToResourceKey(room) === filteredRoom,
                )
            ) {
                return 0;
            }

            // Quick no filter exit check
            if (
                filteredInstructors.length === 0 &&
                filteredCourses.length === 0 &&
                showPAsFor === null
            ) {
                return 1;
            }

            const hasMatchingCourse = event.courses.some((courseId) =>
                matchedCourses.has(courseId),
            );
            const noCourse =
                filteredCourses.length === 0 || event.courses.length === 0;

            if (showPAsFor === null) {
                const hasMatchingInstructor =
                    event.instructors.some((instructorId) =>
                        filteredInstructors.includes(instructorId),
                    ) ||
                    (event.lecturers?.some(
                        (lecturerId) =>
                            typeof lecturerId === "number" &&
                            filteredInstructors.includes(lecturerId),
                    ) ??
                        false);

                return hasMatchingInstructor || hasMatchingCourse ? 1 : 0.2;
            }

            // showPAsFor !== null

            if (!hasMatchingCourse && !noCourse) {
                return 0;
            }
            let paState: PotentialPA = event.personalTalk
                ? PotentialPA.YesRecommended
                : event.required
                    ? PotentialPA.No
                    : PotentialPA.YesNotRecommended;
            if (paState === PotentialPA.YesRecommended) {
                // Check if busy
                if (isInstructorBusy(showPAsFor, event)) {
                    paState = PotentialPA.NoRecommendedButBusy;
                }
            }

            switch (paState) {
            case PotentialPA.YesRecommended:
                return 1;
            case PotentialPA.YesNotRecommended:
                return 0.6;
            case PotentialPA.No:
                return 0.1;
            case PotentialPA.NoRecommendedButBusy:
                return 0.3;
            }

            return 1;
        },
        [
            filteredInstructors,
            filteredCourses,
            matchedCourses,
            showPAsFor,
            hidePrayers,
            filteredRoom,
        ],
    );

    // showMisconfigurations is deliberately excluded: it decorates events
    // rather than removing them, so it can never empty the calendar.
    const hasActiveFilters =
        filteredInstructors.length > 0 ||
        filteredCourses.length > 0 ||
        filteredRoom !== null ||
        showPAsFor !== null ||
        hidePrayers;

    const clearFilters = useCallback(() => {
        setFilteredInstructors([]);
        setFilteredCourses([]);
        setFilteredRoom(null);
        setShowPAsFor(null);
        setHidePrayers(false);
    }, []);

    // Memoized: a fresh object here re-renders every consumer of this
    // context on each render of the provider, app-wide.
    const filtersValue = useMemo(
        () => ({
            default: false,
            filteredInstructors,
            setFilteredInstructors,
            filteredCourses,
            setFilteredCourses,
            showPAsFor,
            setShowPAsFor,
            filteredRoom,
            setFilteredRoom,

            hidePrayers,
            setHidePrayers,
            showMisconfigurations,
            setShowMisconfigurations,

            eventFilteredOpacity,
            hasActiveFilters,
            clearFilters,
        }),
        [
            filteredInstructors,
            setFilteredInstructors,
            filteredCourses,
            setFilteredCourses,
            showPAsFor,
            setShowPAsFor,
            filteredRoom,
            setFilteredRoom,
            hidePrayers,
            setHidePrayers,
            showMisconfigurations,
            setShowMisconfigurations,
            eventFilteredOpacity,
            hasActiveFilters,
            clearFilters,
        ],
    );

    return (
        <CalendarFiltersContext.Provider
            value={filtersValue}
        >
            {children}
        </CalendarFiltersContext.Provider>
    );
};

export const useCalendarFilters = () => {
    const context = useContext(CalendarFiltersContext);

    if (context === undefined || context.default) {
        throw new Error(
            "useCalendarFilters must be used within an CalendarFiltersProvider",
        );
    }

    return context;
};
