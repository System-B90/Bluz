export const dynamic = "force-dynamic";

import {
    ApiSuccess,
    parseJsonBody,
    requireJsonObjectBody,
    ServerApi,
    withApi,
} from "@/api-server/common";
import { DbIterations } from "@/api-server/db-iterations";
import { DbRoomExtendedInfo } from "@/api-server/db-room-extended-info";
import { DbRooms } from "@/api-server/db-rooms";
import {
    archivedIterationCacheControl,
    resolveIterationFromRequest,
    resolveWritableIterationFromRequest,
} from "@/api-server/iteration-request";
import { requireStaffSession } from "@/api-server/session-user";
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

export const GET: ServerApiRoomsGet = withApi(async (request) => {
    await requireStaffSession();
    const { controller, iterationId } =
        await resolveIterationFromRequest(request);
    // Past iterations point at a different Hive instance; fall back to the
    // names cached at creation if that instance is unreachable.
    const iteration = iterationId ? await DbIterations.get(iterationId) : null;
    const rooms = await getAllRooms(
        controller,
        iteration?.hiveUrl,
        iteration?.hiveCache,
    );
    // An archived iteration is read-only end to end — its Hive snapshot and its
    // custom rooms alike — so the response is good for a week. `private`: this
    // sits behind Hive SSO and must not be held by a shared proxy.
    // Event on a live iteration rooms do not alter too often, cache the response for 1 minute to avoid spam
    return ApiSuccess(rooms, archivedIterationCacheControl(iteration) ?? 60);
});

export const POST: ServerApiRoomUpdate = withApi(async (request) => {
    await requireStaffSession();
    const { controller } = await resolveWritableIterationFromRequest(request);
    const room = await requireJsonObjectBody<ApiRoomUpdatePayload>(request);
    await DbRooms.set(room, undefined, controller);
    return ApiSuccess(room);
});

export const PUT: ServerApiRoomCreate = withApi(async (request) => {
    await requireStaffSession();
    const { controller } = await resolveWritableIterationFromRequest(request);
    const room = await requireJsonObjectBody<ApiRoomCreatePayload>(request);
    if (!room.id) {
        throw new ClientApiError("Room id is not provided!");
    }
    const createdRoom = await DbRooms.create(room, controller);
    return ApiSuccess(createdRoom);
});

export const DELETE: ServerApiRoomDelete = withApi(async (request) => {
    await requireStaffSession();
    const { controller } = await resolveWritableIterationFromRequest(request);
    // The client sends a bare JSON string id here, not an object — parse with
    // the shared helper so a malformed payload is a 400, not a 500.
    const roomId = parseJsonBody<ApiRoomDeletePayload>(await request.text());
    if (!roomId) {
        throw new ClientApiError("No roomId provided!");
    }
    await DbRooms.del(roomId, controller);
    return ApiSuccess();
});

export const PATCH: ServerApiRoomExtendedInfoUpdate = withApi(
    async (request) => {
        await requireStaffSession();
        const { controller } =
            await resolveWritableIterationFromRequest(request);
        const payload =
            await requireJsonObjectBody<ApiRoomExtendedInfoUpdatePayload>(
                request,
            );
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
    },
);
