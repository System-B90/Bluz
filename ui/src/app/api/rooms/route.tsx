export const dynamic = "force-dynamic";

import { ApiSuccess, catchHandler, ServerApi } from "@/api-server/common";
import { DbRooms } from "@/api-server/db-rooms";
import { ClientApiError } from "@/api-shared/errors";
import {
    ApiRoomCreatePayload,
    ApiRoomCreateResponse,
    ApiRoomDeletePayload,
    ApiRoomDeleteResponse,
    ApiRoomsGetPayload,
    ApiRoomsGetResponse,
    ApiRoomUpdatePayload,
    ApiRoomUpdateResponse,
} from "@/api-shared/types/room";
import { getAllRooms } from "@/app/api/rooms/utils";

type ServerApiRoomsGet = ServerApi<ApiRoomsGetPayload, ApiRoomsGetResponse>;
type ServerApiRoomUpdate = ServerApi<ApiRoomUpdatePayload, ApiRoomUpdateResponse>;
type ServerApiRoomCreate = ServerApi<ApiRoomCreatePayload, ApiRoomCreateResponse>;
type ServerApiRoomDelete = ServerApi<ApiRoomDeletePayload, ApiRoomDeleteResponse>;

export const GET: ServerApiRoomsGet = async (request) => {
    try {
        const rooms = await getAllRooms();
        return ApiSuccess(rooms);
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const POST: ServerApiRoomUpdate = async (request) => {
    try {
        const room = await request.json();
        if (!room) {
            throw new ClientApiError("No data provided!");
        }
        await DbRooms.set(room);
        return ApiSuccess(room);
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const PUT: ServerApiRoomCreate = async (request) => {
    try {
        const room = await request.json();
        if (!room) {
            throw new ClientApiError("No data provided!");
        }
        if (!room.id) {
            throw new ClientApiError("Room id is not provided!");
        }
        const createdRoom = await DbRooms.create(room);
        return ApiSuccess(createdRoom);
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const DELETE: ServerApiRoomDelete = async (request) => {
    try {
        const roomId = await request.json();
        if (!roomId) {
            throw new ClientApiError("No roomId provided!");
        }
        await DbRooms.del(roomId);
        return ApiSuccess();
    } catch (e) {
        return catchHandler(request, e);
    }
};
