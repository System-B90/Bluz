import { FindOptions, UpdateOptions } from "mongodb";

import { databaseController } from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { ClientApiError } from "@/api-shared/errors";
import { CustomRoom } from "@/api-shared/types/room";
import { MessageTypes } from "@/settings";

async function getDbRooms(options?: FindOptions): Promise<Array<CustomRoom>> {
    const data = databaseController.rooms.find({}, options);
    return await data.toArray();
}

async function setDbRoom(room: CustomRoom, options?: UpdateOptions) {
    const { _id: _, id: roomId, ...roomData } = room as any;
    const data = await databaseController.rooms.updateOne(
        { id: roomId },
        { $set: roomData },
        options,
    );
    if (data.matchedCount === 0 && !options?.upsert) {
        throw new ClientApiError(`No room by id ${roomId} found!`);
    }
    if (data.modifiedCount === 0) {
        throw new ClientApiError(`Room ${roomId} data not modified!`);
    }
    SendServerRequestToSessionServer(MessageTypes.ROOMS_UPDATE, {
        rooms: { [roomId]: room },
    });
}

async function createDbRoom(room: CustomRoom) {
    await databaseController.rooms.insertOne(room as CustomRoom);
    SendServerRequestToSessionServer(MessageTypes.ROOMS_UPDATE, {
        rooms: { [room.id]: room },
    });
    return room;
}

async function deleteDbRoom(roomId: CustomRoom["id"]) {
    const data = await databaseController.rooms.deleteOne({ id: roomId });
    if (data.deletedCount === 0) {
        throw new ClientApiError(`No room by id ${roomId} found!`);
    }
    SendServerRequestToSessionServer(MessageTypes.ROOMS_UPDATE, {
        rooms: { [roomId]: null },
    });
}

export namespace DbRooms {
    export const get = getDbRooms;
    export const set = setDbRoom;
    export const create = createDbRoom;
    export const del = deleteDbRoom;
}
