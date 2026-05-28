import { ApiSuccess, catchHandler, ServerApi } from "@/api-server/common";
import { ApiRoomsGetPayload, ApiRoomsGetResponse } from "@/api-shared/types/room";
import { getAllRooms } from "@/app/api/rooms/utils";

type ServerApiRoomsGet = ServerApi<ApiRoomsGetPayload, ApiRoomsGetResponse>;

export const GET: ServerApiRoomsGet = async (request) => {
    try {
        const rooms = await getAllRooms();
        return ApiSuccess(rooms);
    } catch (e) {
        return catchHandler(request, e);
    }
};
