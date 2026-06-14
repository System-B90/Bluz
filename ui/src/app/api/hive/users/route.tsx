import { ApiSuccess, catchHandler, ServerApi } from "@/api-server/common";
import { createHiveClient } from "@/api-server/hive/session-client";
import {
    ApiHiveUsersGetPayload,
    ApiHiveUsersGetResponse,
} from "@/api-shared/types/hive";

type ServerApiHiveUsersGet = ServerApi<
  ApiHiveUsersGetPayload,
  ApiHiveUsersGetResponse
>;

export const GET: ServerApiHiveUsersGet = async (request) => {
    try {
        const hiveClient = await createHiveClient();
        return ApiSuccess(await hiveClient.getUsers());
    } catch (e) {
        return catchHandler(request, e);
    }
};
