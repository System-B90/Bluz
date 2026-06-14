import { ApiSuccess, catchHandler, ServerApi } from "@/api-server/common";
import { createHiveClient } from "@/api-server/hive/session-client";
import {
    ApiHiveSubjectsGetPayload,
    ApiHiveSubjectsGetResponse,
} from "@/api-shared/types/subject";

type ServerApiHiveSubjectsGet = ServerApi<
  ApiHiveSubjectsGetPayload,
  ApiHiveSubjectsGetResponse
>;

export const GET: ServerApiHiveSubjectsGet = async (request) => {
    try {
        const hiveClient = await createHiveClient();
        const subjects = await hiveClient.getSubjects();
        return ApiSuccess(subjects);
    } catch (e) {
        return catchHandler(request, e);
    }
};
