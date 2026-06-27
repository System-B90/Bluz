export const dynamic = "force-dynamic";

import { ApiSuccess, catchHandler, ServerApi } from "@/api-server/common";
import { DbIterations } from "@/api-server/db-iterations";
import { DbRoomExtendedInfo } from "@/api-server/db-room-extended-info";
import { DbRooms } from "@/api-server/db-rooms";
import {
    resolveIterationFromRequest,
    resolveWritableIterationFromRequest,
} from "@/api-server/iteration-request";
import { ClientApiError } from "@/api-shared/errors";
import {
    ApiRoomCreatePayload,
    ApiRoomCreateResponse,
    ApiRoomDeletePayload,
    ApiRoomDeleteResponse,
    ApiRoomExtendedInfoUpdatePayload,
    ApiRoomExtendedInfoUpdateResponse,
    ApiRoomsGetPayload,
    ApiRoomsGetResponse,
    ApiRoomUpdatePayload,
    ApiRoomUpdateResponse,
} from "@/api-shared/types/room";
import { getAllRooms } from "@/app/api/rooms/utils";

type ServerApiRoomsGet = ServerApi<ApiRoomsGetPayload, ApiRoomsGetResponse>;
type ServerApiRoomUpdate = ServerApi<
    ApiRoomUpdatePayload,
    ApiRoomUpdateResponse
>;
type ServerApiRoomCreate = ServerApi<
    ApiRoomCreatePayload,
    ApiRoomCreateResponse
>;
type ServerApiRoomDelete = ServerApi<
    ApiRoomDeletePayload,
    ApiRoomDeleteResponse
>;
type ServerApiRoomExtendedInfoUpdate = ServerApi<
    ApiRoomExtendedInfoUpdatePayload,
    ApiRoomExtendedInfoUpdateResponse
>;

export const GET: ServerApiRoomsGet = async (request) => {
    try {
        const { controller, iterationId } =
            await resolveIterationFromRequest(request);
        // Past iterations point at a different Hive instance.
        const hiveUrl = iterationId
            ? (await DbIterations.get(iterationId))?.hiveUrl
            : undefined;
        const rooms = await getAllRooms(controller, hiveUrl);
        return ApiSuccess(rooms);
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const POST: ServerApiRoomUpdate = async (request) => {
    try {
        const { controller } =
            await resolveWritableIterationFromRequest(request);
        const room = await request.json();
        if (!room) {
            throw new ClientApiError("No data provided!");
        }
        await DbRooms.set(room, undefined, controller);
        return ApiSuccess(room);
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const PUT: ServerApiRoomCreate = async (request) => {
    try {
        const { controller } =
            await resolveWritableIterationFromRequest(request);
        const room = await request.json();
        if (!room) {
            throw new ClientApiError("No data provided!");
        }
        if (!room.id) {
            throw new ClientApiError("Room id is not provided!");
        }
        const createdRoom = await DbRooms.create(room, controller);
        return ApiSuccess(createdRoom);
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const DELETE: ServerApiRoomDelete = async (request) => {
    try {
        const { controller } =
            await resolveWritableIterationFromRequest(request);
        const roomId = await request.json();
        if (!roomId) {
            throw new ClientApiError("No roomId provided!");
        }
        await DbRooms.del(roomId, controller);
        return ApiSuccess();
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const PATCH: ServerApiRoomExtendedInfoUpdate = async (request) => {
    try {
        const { controller } =
            await resolveWritableIterationFromRequest(request);
        const payload = await request.json();
        if (
            !payload ||
            payload.roomId === undefined ||
            payload.roomSource === undefined ||
            !payload.extendedInfo
        ) {
            throw new ClientApiError(
                "Invalid payload for room extended info update!",
            );
        }
        await DbRoomExtendedInfo.upsert(
            payload.roomId,
            payload.roomSource,
            payload.extendedInfo,
            controller,
        );
        return ApiSuccess();
    } catch (e) {
        return catchHandler(request, e);
    }
};
