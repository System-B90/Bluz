import { ClientApi, ClientApiNoPayload, safeApiFetcher } from "@/api-client/common";
import {
    ApiCourseCreatePayload,
    ApiCourseCreateResponse,
    ApiCourseDeletePayload,
    ApiCourseDeleteResponse,
    ApiCourseGetResponse,
    ApiCourseUpdatePayload,
    ApiCourseUpdateResponse,
} from "@/api-shared/types/course";

type ClientApiGetCourses = ClientApiNoPayload<ApiCourseGetResponse>;
type ClientApiSetCourse = ClientApi<ApiCourseUpdatePayload, ApiCourseUpdateResponse>;
type ClientApiCreateCourse = ClientApi<ApiCourseCreatePayload, ApiCourseCreateResponse>;
type ClientApiDeleteCourse = ClientApi<ApiCourseDeletePayload, ApiCourseDeleteResponse>;

export const apiGetCourses: ClientApiGetCourses = async (props) => {
    return await safeApiFetcher<ApiCourseGetResponse>("/api/course", props);
};

export const apiSetCourse: ClientApiSetCourse = async (course, props) => {
    return await safeApiFetcher<ApiCourseUpdateResponse>("/api/course", {
        ...props,
        method: "POST",
        body: JSON.stringify(course),
    });
};

export const apiCreateCourse: ClientApiCreateCourse = async (course, props) => {
    return await safeApiFetcher<ApiCourseCreateResponse>("/api/course", {
        ...props,
        method: "PUT",
        body: JSON.stringify(course),
    });
};

export const apiDeleteCourse: ClientApiDeleteCourse = async (courseId, props) => {
    await safeApiFetcher<ApiCourseDeleteResponse>("/api/course", {
        ...props,
        method: "DELETE",
        body: JSON.stringify(courseId),
    });
};
