import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import {
    ApiStudentScheduleGetResponse,
    STUDENT_VIEW_DATE_PARAM,
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
): Promise<ApiStudentScheduleGetResponse> => {
    const query = date
        ? `?${STUDENT_VIEW_DATE_PARAM}=${encodeURIComponent(date)}`
        : "";
    return await safeApiFetcher<ApiStudentScheduleGetResponse>(
        `/api/student-view/schedule${query}`,
        props,
    );
};
