import {
    ClientApi,
    ClientApiProps,
    safeApiFetcher,
} from "@/api-client/common";
import { iterationEndpoint } from "@/api-client/iteration-query";
import { IterationId } from "@/api-shared/types/iteration";
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

type ClientApiGetRooms = (
    props?: ClientApiProps,
    iterationId?: IterationId,
) => Promise<ApiRoomsGetResponse>;
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

/**
 * Rooms come from the iteration's own database, merged with its Hive
 * instance. A past iteration answers from the frozen snapshot, and that
 * response is cached for a week (see `archivedIterationCacheControl`).
 */
export const apiGetRooms: ClientApiGetRooms = async (props, iterationId) => {
    return await safeApiFetcher<ApiRoomsGetResponse>(
        iterationEndpoint("/api/rooms", iterationId),
        props,
    );
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
