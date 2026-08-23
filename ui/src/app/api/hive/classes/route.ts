import { ApiSuccess, ServerApi, withApi } from "@/api-server/common";
import { createHiveClient } from "@/api-server/hive/session-client";
import { requireStaffSession } from "@/api-server/session-user";
import {
    ApiHiveClassesGetPayload,
    ApiHiveClassesGetResponse,
} from "@/api-shared/types/hive";

type ServerApiHiveClassesGet = ServerApi<
    ApiHiveClassesGetPayload,
    ApiHiveClassesGetResponse
>;

export const GET: ServerApiHiveClassesGet = withApi(async (_request) => {
    await requireStaffSession();
    const hiveClient = await createHiveClient();
    const data = await hiveClient.getClasses();

    return ApiSuccess(data);
});
