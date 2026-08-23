export const dynamic = "force-dynamic";

import { ApiSuccess, ServerApi, withApi } from "@/api-server/common";
import { DbCourses } from "@/api-server/db-courses";
import {
    resolveIterationFromRequest,
    resolveWritableIterationFromRequest,
} from "@/api-server/iteration-request";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import {
    ApiCourseCreatePayload,
    ApiCourseCreateResponse,
    ApiCourseDeletePayload,
    ApiCourseDeleteResponse,
    ApiCourseGetPayload,
    ApiCourseGetResponse,
    ApiCourseUpdatePayload,
    ApiCourseUpdateResponse,
} from "@/api-shared/types/course";

type ServerApiCourseGet = ServerApi<ApiCourseGetPayload, ApiCourseGetResponse>;
type ServerApiCourseUpdate = ServerApi<
    ApiCourseUpdatePayload,
    ApiCourseUpdateResponse
>;
type ServerApiCourseCreate = ServerApi<
    ApiCourseCreatePayload,
    ApiCourseCreateResponse
>;
type ServerApiCourseDelete = ServerApi<
    ApiCourseDeletePayload,
    ApiCourseDeleteResponse
>;

export const GET: ServerApiCourseGet = withApi(async (request) => {
    await requireStaffSession();
    const { controller } = await resolveIterationFromRequest(request);
    const data = await DbCourses.get(undefined, controller);
    return ApiSuccess(data);
});

export const POST: ServerApiCourseUpdate = withApi(async (request) => {
    await requireStaffSession();
    const { controller } =
        await resolveWritableIterationFromRequest(request);
    const course = await request.json();
    if (!course) {
        throw new ClientApiError("No data provided!");
    }
    await DbCourses.set(course, undefined, controller);
    return ApiSuccess(course);
});

export const DELETE: ServerApiCourseDelete = withApi(async (request) => {
    await requireStaffSession();
    const { controller } =
        await resolveWritableIterationFromRequest(request);
    const courseId = await request.json();
    if (!courseId) {
        throw new ClientApiError("No courseId provided!");
    }
    await DbCourses.del(courseId, controller);
    return ApiSuccess();
});

export const PUT: ServerApiCourseCreate = withApi(async (request) => {
    await requireStaffSession();
    const { controller } =
        await resolveWritableIterationFromRequest(request);
    const course = await request.json();
    if (!course) {
        throw new ClientApiError("No data provided!");
    }
    if (!course.id) {
        throw new ClientApiError("Course id is not provided!");
    }
    const createdCourse = await DbCourses.create(course, controller);
    return ApiSuccess(createdCourse);
});
