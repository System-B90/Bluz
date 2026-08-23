export const dynamic = "force-dynamic";

import {
    ApiSuccess,
    parseJsonBody,
    requireJsonObjectBody,
    ServerApi,
    withApi,
} from "@/api-server/common";
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
    const { controller } = await resolveWritableIterationFromRequest(request);
    const course = await requireJsonObjectBody<ApiCourseUpdatePayload>(request);
    await DbCourses.set(course, undefined, controller);
    return ApiSuccess(course);
});

export const DELETE: ServerApiCourseDelete = withApi(async (request) => {
    await requireStaffSession();
    const { controller } = await resolveWritableIterationFromRequest(request);
    // The client sends a bare JSON string id here, not an object — parse with
    // the shared helper so a malformed payload is a 400, not a 500.
    const courseId = parseJsonBody<ApiCourseDeletePayload>(
        await request.text(),
    );
    if (!courseId) {
        throw new ClientApiError("No courseId provided!");
    }
    await DbCourses.del(courseId, controller);
    return ApiSuccess();
});

export const PUT: ServerApiCourseCreate = withApi(async (request) => {
    await requireStaffSession();
    const { controller } = await resolveWritableIterationFromRequest(request);
    const course = await requireJsonObjectBody<ApiCourseCreatePayload>(request);
    if (!course.id) {
        throw new ClientApiError("Course id is not provided!");
    }
    const createdCourse = await DbCourses.create(course, controller);
    return ApiSuccess(createdCourse);
});
