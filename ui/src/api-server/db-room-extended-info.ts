import {
    databaseController,
    DatabaseController,
} from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import {
    RoomExtendedInfo,
    RoomId,
    RoomLike,
    roomLikeToResourceKey,
    RoomSource,
} from "@/api-shared/types/room";
import { MessageTypes } from "@/settings";

async function getAllExtendedInfo(
    controller: DatabaseController = databaseController,
) {
    return await controller.roomExtendedInfo.find({}).toArray();
}

async function upsertExtendedInfo(
    roomId: RoomId,
    roomSource: RoomSource,
    extendedInfo: RoomExtendedInfo,
    controller: DatabaseController = databaseController,
) {
    await controller.roomExtendedInfo.updateOne(
        { roomId, roomSource },
        { $set: { roomId, roomSource, ...extendedInfo } },
        { upsert: true },
    );
    SendServerRequestToSessionServer(MessageTypes.ROOMS_UPDATE, {
        // Keyed in the same round-trip-safe colon format used everywhere else;
        // no client currently reads this field (RoomsProvider consumes the
        // `rooms` payload key), but it must not reintroduce the legacy dash
        // format retired in #544/17.
        roomExtendedInfo: {
            [roomLikeToResourceKey({
                id: roomId,
                source: roomSource,
            } as RoomLike)]: extendedInfo,
        },
    });
}

export namespace DbRoomExtendedInfo {
    export const getAll = getAllExtendedInfo;
    export const upsert = upsertExtendedInfo;
}
