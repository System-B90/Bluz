import {
    ApiStudentScheduleGetResponse,
    StudentSchedule,
} from "@/api-shared/types/student-view";

/**
 * Expands the normalized schedule response back into per-event names.
 * Groups resolve once, so events sharing a course set share one array.
 */
export function resolveStudentSchedule({
    courseGroups,
    courseNames,
    events,
    roomNames,
    ...rest
}: ApiStudentScheduleGetResponse): StudentSchedule {
    const groups = courseGroups.map((group) =>
        group.map((index) => courseNames[index]),
    );
    return {
        ...rest,
        events: events.map((event) => ({
            ...event,
            courses: groups[event.courses],
            relatedCourses: groups[event.relatedCourses],
            rooms: event.rooms.map((index) => roomNames[index]),
        })),
    };
}
