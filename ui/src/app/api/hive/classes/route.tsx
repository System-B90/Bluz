import { ApiSuccess, ServerApi, withApi } from "@/api-server/common";
import { createHiveClient } from "@/api-server/hive/session-client";
import {
    ApiHiveClassesGetPayload,
    ApiHiveClassesGetResponse,
} from "@/api-shared/types/hive";

type ServerApiHiveClassesGet = ServerApi<
    ApiHiveClassesGetPayload,
    ApiHiveClassesGetResponse
>;

export const GET: ServerApiHiveClassesGet = withApi(async (request) => {
    const hiveClient = await createHiveClient();
    const data = await hiveClient.getClasses();

    return ApiSuccess(data);
});
