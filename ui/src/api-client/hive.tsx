import { ClientApi, ClientApiNoPayload, safeApiFetcher } from "@/api-client/common";
import {
    ApiHiveClassesGetResponse,
    ApiHiveLessonsGetPayload,
    ApiHiveLessonsGetResponse,
    ApiHiveQueuesGetPayload,
    ApiHiveQueuesGetResponse,
    ApiHiveStudentsGetResponse,
    ApiHiveUsersGetResponse,
} from "@/api-shared/types/hive";
import { ApiHiveModulesGetResponse } from "@/api-shared/types/module";
import { ApiHiveSubjectsGetResponse } from "@/api-shared/types/subject";

type ClientApiGetStudents = ClientApiNoPayload<ApiHiveStudentsGetResponse>;
type ClientApiGetClasses = ClientApiNoPayload<ApiHiveClassesGetResponse>;
type ClientApiGetSubjects = ClientApiNoPayload<ApiHiveSubjectsGetResponse>;
type ClientApiGetHiveUsers = ClientApiNoPayload<ApiHiveUsersGetResponse>;
type ClientApiGetModules = ClientApiNoPayload<ApiHiveModulesGetResponse>;
type ClientApiGetLessons = ClientApi<ApiHiveLessonsGetPayload, ApiHiveLessonsGetResponse>;
type ClientApiGetQueues = ClientApi<ApiHiveQueuesGetPayload, ApiHiveQueuesGetResponse>;

export const apiGetStudents: ClientApiGetStudents = async (props) => {
    return await safeApiFetcher<ApiHiveStudentsGetResponse>(
        "/api/hive/students",
        props,
    );
};

export const apiGetClasses: ClientApiGetClasses = async (props) => {
    return await safeApiFetcher<ApiHiveClassesGetResponse>(
        "/api/hive/classes",
        props,
    );
};

export const apiGetSubjects: ClientApiGetSubjects = async (props) => {
    return await safeApiFetcher<ApiHiveSubjectsGetResponse>(
        "/api/hive/subjects",
        props,
    );
};

export const getHiveUsers: ClientApiGetHiveUsers = async (props) => {
    return await safeApiFetcher<ApiHiveUsersGetResponse>(
        "/api/hive/users",
        props,
    );
};

export const apiGetModules: ClientApiGetModules = async (props) => {
    return await safeApiFetcher<ApiHiveModulesGetResponse>(
        "/api/hive/modules",
        props,
    );
};

export const apiGetQueues: ClientApiGetQueues = async (payload, props) => {
    return await safeApiFetcher<ApiHiveQueuesGetResponse>(
        `/api/hive/queues?module=${payload.module}`,
        props,
    );
};

export const apiGetLessons: ClientApiGetLessons = async (payload, props) => {
    const params = new URLSearchParams();
    if (payload) {
        if (payload.module__id !== undefined) {
            params.set("module__id", String(payload.module__id));
        }
        if (payload.module__parent_subject__parent_program_id__in !== undefined) {
            const val = payload.module__parent_subject__parent_program_id__in;
            params.set(
                "module__parent_subject__parent_program_id__in",
                Array.isArray(val) ? val.join(",") : String(val),
            );
        }
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return await safeApiFetcher<ApiHiveLessonsGetResponse>(
        `/api/hive/lessons${query}`,
        props,
    );
};
