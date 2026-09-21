import { FindOptions, UpdateOptions } from "mongodb";

import { pickFields } from "@/api-server/common";
import {
    databaseController,
    DatabaseController,
} from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { ClientApiError } from "@/api-shared/errors";
import { CustomRoom } from "@/api-shared/types/room";
import { MessageTypes } from "@/settings";

// Client payloads are copied field-by-field, so the document shape is an
// explicit allow-list rather than whatever the caller sent (#538 item 4).
const ROOM_FIELDS = [
    "id",
    "name",
    "description",
    "source",
    "extendedInfo",
] as const;

async function getDbRooms(
    options?: FindOptions,
    controller: DatabaseController = databaseController,
): Promise<Array<CustomRoom>> {
    const data = controller.rooms.find({}, options);
    return await data.toArray();
}

async function setDbRoom(
    room: CustomRoom,
    options?: UpdateOptions,
    controller: DatabaseController = databaseController,
) {
    // Same allow-list as create: the payload is client-supplied (#538 item 4).
    const { id: roomId, ...roomData } = pickFields(room, ROOM_FIELDS);
    const data = await controller.rooms.updateOne(
        { id: roomId },
        { $set: roomData },
        options,
    );
    if (data.matchedCount === 0 && !options?.upsert) {
        throw new ClientApiError(`No room by id ${roomId} found!`);
    }
    SendServerRequestToSessionServer(MessageTypes.ROOMS_UPDATE, {
        rooms: { [roomId]: room },
    });
}

async function createDbRoom(
    room: CustomRoom,
    controller: DatabaseController = databaseController,
) {
    const document = pickFields(room, ROOM_FIELDS);
    await controller.rooms.insertOne(document as CustomRoom);
    SendServerRequestToSessionServer(MessageTypes.ROOMS_UPDATE, {
        rooms: { [room.id]: room },
    });
    return room;
}

async function deleteDbRoom(
    roomId: CustomRoom["id"],
    controller: DatabaseController = databaseController,
) {
    const data = await controller.rooms.deleteOne({ id: roomId });
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
