import { ApiSuccess, catchHandler, ServerApi } from "@/api-server/common";
import { createHiveClient } from "@/api-server/hive/session-client";
import {
    ApiHiveRoomsGetPayload,
    ApiHiveRoomsGetResponse,
} from "@/api-shared/types/hive";

type ServerApiHiveRoomsGet = ServerApi<
    ApiHiveRoomsGetPayload,
    ApiHiveRoomsGetResponse
>;

export const GET: ServerApiHiveRoomsGet = async (request) => {
    try {
        const hiveClient = await createHiveClient();
        const data = await hiveClient.getRooms();

        return ApiSuccess(data);
    } catch (e) {
        return catchHandler(request, e);
    }
};
