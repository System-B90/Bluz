import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { resolveStudentSchedule } from "@/api-shared/student-schedule";
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
    return resolveStudentSchedule(
        await safeApiFetcher<ApiStudentScheduleGetResponse>(
            `/api/student-view/schedule${query}`,
            props,
        ),
    );
};
