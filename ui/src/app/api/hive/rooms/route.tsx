import { ApiSuccess, ServerApi, withApi } from "@/api-server/common";
import { createHiveClient } from "@/api-server/hive/session-client";
import {
    ApiHiveRoomsGetPayload,
    ApiHiveRoomsGetResponse,
} from "@/api-shared/types/hive";

type ServerApiHiveRoomsGet = ServerApi<
    ApiHiveRoomsGetPayload,
    ApiHiveRoomsGetResponse
>;

export const GET: ServerApiHiveRoomsGet = withApi(async (request) => {
    const hiveClient = await createHiveClient();
    const data = await hiveClient.getRooms();

    return ApiSuccess(data);
});
