export const dynamic = "force-dynamic";

import { ApiSuccess, catchHandler, ServerApi } from "@/api-server/common";
import { DbCourses } from "@/api-server/db-courses";
import {
    resolveIterationFromRequest,
    resolveWritableIterationFromRequest,
} from "@/api-server/iteration-request";
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

export const GET: ServerApiCourseGet = async (request) => {
    try {
        const { controller } = await resolveIterationFromRequest(request);
        const data = await DbCourses.get(undefined, controller);
        return ApiSuccess(data);
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const POST: ServerApiCourseUpdate = async (request) => {
    try {
        const { controller } =
            await resolveWritableIterationFromRequest(request);
        const course = await request.json();
        if (!course) {
            throw new ClientApiError("No data provided!");
        }
        await DbCourses.set(course, undefined, controller);
        return ApiSuccess(course);
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const DELETE: ServerApiCourseDelete = async (request) => {
    try {
        const { controller } =
            await resolveWritableIterationFromRequest(request);
        const courseId = await request.json();
        if (!courseId) {
            throw new ClientApiError("No courseId provided!");
        }
        await DbCourses.del(courseId, controller);
        return ApiSuccess();
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const PUT: ServerApiCourseCreate = async (request) => {
    try {
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
    } catch (e) {
        return catchHandler(request, e);
    }
};
