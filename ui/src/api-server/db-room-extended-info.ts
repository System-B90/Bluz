import { databaseController } from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { RoomExtendedInfo, RoomId, RoomSource } from "@/api-shared/types/room";
import { MessageTypes } from "@/settings";

async function getAllExtendedInfo() {
    return await databaseController.roomExtendedInfo.find({}).toArray();
}

async function upsertExtendedInfo(
    roomId: RoomId,
    roomSource: RoomSource,
    extendedInfo: RoomExtendedInfo,
) {
    await databaseController.roomExtendedInfo.updateOne(
        { roomId, roomSource },
        { $set: { roomId, roomSource, ...extendedInfo } },
        { upsert: true },
    );
    SendServerRequestToSessionServer(MessageTypes.ROOMS_UPDATE, {
        roomExtendedInfo: { [`${roomSource}-${roomId}`]: extendedInfo },
    });
}

export namespace DbRoomExtendedInfo {
    export const getAll = getAllExtendedInfo;
    export const upsert = upsertExtendedInfo;
}
