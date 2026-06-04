import { DbRoomExtendedInfo } from "@/api-server/db-room-extended-info";
import { createHiveClient } from "@/api-server/hive/session-client";
import { databaseController } from "@/api-server/mongo-db-controller";
import {
    CustomRoom,
    HiveRoom,
    Room,
    RoomSource,
    roomToKey,
} from "@/api-shared/types/room";

export async function getAllRooms(): Promise<Array<Room>> {
    const hiveClient = await createHiveClient();
    const hiveRooms: Array<HiveRoom> = await hiveClient.getRooms();
    const customRooms: Array<CustomRoom> = (
        await databaseController.rooms.find({}).toArray()
    ).map((r) => ({ ...r, source: RoomSource.Custom }));

    const allRooms: Array<Room> = [...hiveRooms, ...customRooms];

    // Merge extended info onto rooms
    const extendedInfoDocs = await DbRoomExtendedInfo.getAll();
    const extendedInfoMap = new Map(
        extendedInfoDocs.map((doc) => [
            `${doc.roomSource}-${doc.roomId}`,
            {
                workstationCount: doc.workstationCount,
                lectureSeatCount: doc.lectureSeatCount,
                lectureComfortable: doc.lectureComfortable,
            },
        ]),
    );

    return allRooms.map((room) => {
        const key = roomToKey(room);
        const extInfo = extendedInfoMap.get(key);
        return extInfo ? { ...room, extendedInfo: extInfo } : room;
    });
}
