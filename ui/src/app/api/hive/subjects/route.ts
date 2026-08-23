import { ApiSuccess, ServerApi, withApi } from "@/api-server/common";
import { createHiveClient } from "@/api-server/hive/session-client";
import { requireStaffSession } from "@/api-server/session-user";
import {
    ApiHiveSubjectsGetPayload,
    ApiHiveSubjectsGetResponse,
} from "@/api-shared/types/subject";

type ServerApiHiveSubjectsGet = ServerApi<
    ApiHiveSubjectsGetPayload,
    ApiHiveSubjectsGetResponse
>;

export const GET: ServerApiHiveSubjectsGet = withApi(async (_request) => {
    await requireStaffSession();
    const hiveClient = await createHiveClient();
    const subjects = await hiveClient.getSubjects();
    return ApiSuccess(subjects);
});
