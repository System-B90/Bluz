export const dynamic = "force-dynamic";

import { ApiSuccess, ServerApi, withApi } from "@/api-server/common";
import { resolveIterationFromRequest } from "@/api-server/iteration-request";
import {
    buildStudentSchedule,
    requireStudentViewSession,
    resolveStudentViewDate,
} from "@/api-server/student-view";
import {
    ApiStudentScheduleGetPayload,
    ApiStudentScheduleGetResponse,
    STUDENT_VIEW_DATE_PARAM,
} from "@/api-shared/types/student-view";

type ServerApiStudentScheduleGet = ServerApi<
    ApiStudentScheduleGetPayload,
    ApiStudentScheduleGetResponse
>;

/**
 * The only endpoint a student session may call (#656). It is read-only, serves
 * a single day, and returns the `StudentEvent` projection — never a raw event
 * document. There is deliberately no POST/PUT/DELETE here.
 *
 * Iteration scoping: students are pinned to the current iteration. Staff may
 * pass `?it=` while previewing, exactly as the rest of the calendar does.
 */
export const GET: ServerApiStudentScheduleGet = withApi(async (request) => {
    const { isStaff } = await requireStudentViewSession();

    const date = resolveStudentViewDate(
        request.nextUrl.searchParams.get(STUDENT_VIEW_DATE_PARAM),
        isStaff,
    );

    const { controller } = isStaff
        ? await resolveIterationFromRequest(request)
        : await resolveIterationFromRequest({
            nextUrl: new URL(request.nextUrl.origin),
        });

    return ApiSuccess(await buildStudentSchedule(date, controller));
});
