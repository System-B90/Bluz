export const dynamic = "force-dynamic";

import { ApiSuccess, catchHandler, ServerApi } from "@/api-server/common";
import { DbCourses } from "@/api-server/db-courses";
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
        const data = await DbCourses.get();
        return ApiSuccess(data);
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const POST: ServerApiCourseUpdate = async (request) => {
    try {
        const course = await request.json();
        if (!course) {
            throw new ClientApiError("No data provided!");
        }
        await DbCourses.set(course);
        return ApiSuccess(course);
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const DELETE: ServerApiCourseDelete = async (request) => {
    try {
        const courseId = await request.json();
        if (!courseId) {
            throw new ClientApiError("No courseId provided!");
        }
        await DbCourses.del(courseId);
        return ApiSuccess();
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const PUT: ServerApiCourseCreate = async (request) => {
    try {
        const course = await request.json();
        if (!course) {
            throw new ClientApiError("No data provided!");
        }
        if (!course.id) {
            throw new ClientApiError("Course id is not provided!");
        }
        const createdCourse = await DbCourses.create(course);
        return ApiSuccess(createdCourse);
    } catch (e) {
        return catchHandler(request, e);
    }
};
