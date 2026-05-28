import { ClientApiNoPayload, safeApiFetcher } from "@/api-client/common";
import { ApiRoomsGetResponse } from "@/api-shared/types/room";

type ClientApiGetRooms = ClientApiNoPayload<ApiRoomsGetResponse>;

export const apiGetRooms: ClientApiGetRooms = async (props) => {
    return await safeApiFetcher<ApiRoomsGetResponse>("/api/rooms", props);
};
