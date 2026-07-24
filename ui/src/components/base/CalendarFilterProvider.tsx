"use client";
import {
    createContext,
    Dispatch,
    SetStateAction,
    useCallback,
    useContext,
    useState,
} from "react";

import { PotentialPA } from "@/api-shared/types";
import { CourseId } from "@/api-shared/types/course";
import { roomLikeToResourceKey } from "@/api-shared/types/room";
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
                filteredCourses.includes(courseId),
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
            showPAsFor,
            hidePrayers,
            filteredRoom,
        ],
    );

    return (
        <CalendarFiltersContext.Provider
            value={{
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
            }}
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
