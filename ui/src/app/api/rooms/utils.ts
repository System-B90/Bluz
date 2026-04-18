import { createHiveClient } from "@/api-server/hive/session-client";
import { databaseController } from "@/api-server/mongo-db-controller";
import {
    CustomRoom,
    HiveRoom,
    Room,
    RoomSource,
} from "@/components/schedule/types/room";

export async function getAllRooms(): Promise<Array<Room>> {
    const hiveClient = await createHiveClient();
    const hiveRooms: Array<HiveRoom> = await hiveClient.getRooms();
    const customRooms: Array<CustomRoom> = (
        await databaseController.rooms.find({}).toArray()
    ).map((r) => ({ ...r, source: RoomSource.Custom }));
    return [...hiveRooms, ...customRooms];
}
