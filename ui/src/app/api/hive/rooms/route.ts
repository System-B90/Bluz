import { ApiSuccess, ServerApi, withApi } from "@/api-server/common";
import { createHiveClient } from "@/api-server/hive/session-client";
import { requireStaffSession } from "@/api-server/session-user";
import {
    ApiHiveRoomsGetPayload,
    ApiHiveRoomsGetResponse,
} from "@/api-shared/types/hive";

type ServerApiHiveRoomsGet = ServerApi<
    ApiHiveRoomsGetPayload,
    ApiHiveRoomsGetResponse
>;

export const GET: ServerApiHiveRoomsGet = withApi(async (_request) => {
    await requireStaffSession();
    const hiveClient = await createHiveClient();
    const data = await hiveClient.getRooms();

    return ApiSuccess(data);
});
