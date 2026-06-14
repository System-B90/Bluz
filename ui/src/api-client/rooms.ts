import {
    ClientApi,
    ClientApiNoPayload,
    safeApiFetcher,
} from "@/api-client/common";
import {
    ApiRoomCreatePayload,
    ApiRoomCreateResponse,
    ApiRoomDeletePayload,
    ApiRoomDeleteResponse,
    ApiRoomExtendedInfoUpdatePayload,
    ApiRoomExtendedInfoUpdateResponse,
    ApiRoomsGetResponse,
    ApiRoomUpdatePayload,
    ApiRoomUpdateResponse,
} from "@/api-shared/types/room";

type ClientApiGetRooms = ClientApiNoPayload<ApiRoomsGetResponse>;
type ClientApiCreateRoom = ClientApi<
  ApiRoomCreatePayload,
  ApiRoomCreateResponse
>;
type ClientApiUpdateRoom = ClientApi<
  ApiRoomUpdatePayload,
  ApiRoomUpdateResponse
>;
type ClientApiDeleteRoom = ClientApi<
  ApiRoomDeletePayload,
  ApiRoomDeleteResponse
>;
type ClientApiUpdateRoomExtendedInfo = ClientApi<
  ApiRoomExtendedInfoUpdatePayload,
  ApiRoomExtendedInfoUpdateResponse
>;

export const apiGetRooms: ClientApiGetRooms = async (props) => {
    return await safeApiFetcher<ApiRoomsGetResponse>("/api/rooms", props);
};

export const apiCreateRoom: ClientApiCreateRoom = async (room, props) => {
    return await safeApiFetcher<ApiRoomCreateResponse>("/api/rooms", {
        ...props,
        method: "PUT",
        body: JSON.stringify(room),
    });
};

export const apiUpdateRoom: ClientApiUpdateRoom = async (room, props) => {
    return await safeApiFetcher<ApiRoomUpdateResponse>("/api/rooms", {
        ...props,
        method: "POST",
        body: JSON.stringify(room),
    });
};

export const apiDeleteRoom: ClientApiDeleteRoom = async (roomId, props) => {
    await safeApiFetcher<ApiRoomDeleteResponse>("/api/rooms", {
        ...props,
        method: "DELETE",
        body: JSON.stringify(roomId),
    });
};

export const apiUpdateRoomExtendedInfo: ClientApiUpdateRoomExtendedInfo =
  async (payload, props) => {
      await safeApiFetcher<ApiRoomExtendedInfoUpdateResponse>("/api/rooms", {
          ...props,
          method: "PATCH",
          body: JSON.stringify(payload),
      });
  };
