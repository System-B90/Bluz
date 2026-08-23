import { ApiSuccess, ServerApi, withApi } from "@/api-server/common";
import { createHiveClient } from "@/api-server/hive/session-client";
import { requireStaffSession } from "@/api-server/session-user";
import {
    ApiHiveUsersGetPayload,
    ApiHiveUsersGetResponse,
} from "@/api-shared/types/hive";

type ServerApiHiveUsersGet = ServerApi<
    ApiHiveUsersGetPayload,
    ApiHiveUsersGetResponse
>;

export const GET: ServerApiHiveUsersGet = withApi(async (_request) => {
    await requireStaffSession();
    const hiveClient = await createHiveClient();
    return ApiSuccess(await hiveClient.getUsers());
});
