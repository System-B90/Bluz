import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import {
    ApiStudentScheduleGetResponse,
    STUDENT_VIEW_DATE_PARAM,
    StudentSchedule,
} from "@/api-shared/types/student-view";

/**
 * Fetches the student projection of one day's schedule.
 *
 * `date` is a *staff preview* affordance only — a student session that sends
 * it is rejected by the server, which always serves its own current day.
 */
export const apiGetStudentSchedule = async (
    date: string | undefined,
    props?: ClientApiProps,
): Promise<StudentSchedule> => {
    const query = date
        ? `?${STUDENT_VIEW_DATE_PARAM}=${encodeURIComponent(date)}`
        : "";
    const { courseGroups, courseNames, events, roomNames, ...rest } =
        await safeApiFetcher<ApiStudentScheduleGetResponse>(
            `/api/student-view/schedule${query}`,
            props,
        );
    // Resolved once per group, so events sharing a course set share one array.
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
};
