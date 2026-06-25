import { ClientApiNoPayload, safeApiFetcher } from "@/api-client/common";
import {
    ApiHiveClassesGetResponse,
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
