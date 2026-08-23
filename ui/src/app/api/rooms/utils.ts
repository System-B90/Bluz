import { DbRoomExtendedInfo } from "@/api-server/db-room-extended-info";
import { createHiveClient } from "@/api-server/hive/session-client";
import {
    databaseController,
    DatabaseController,
} from "@/api-server/mongo-db-controller";
import { ClassTypeEnum } from "@/api-shared/types/hive";
import { HiveIterationCache } from "@/api-shared/types/iteration";
import {
    CustomRoom,
    HiveRoom,
    Room,
    RoomLike,
    roomLikeToResourceKey,
    RoomSource,
} from "@/api-shared/types/room";

/** Reconstruct minimal Hive rooms from a cached id→name snapshot. */
function roomsFromCache(cache: HiveIterationCache): Array<HiveRoom> {
    return Object.entries(cache.rooms).map(
        ([id, name]) =>
            ({
                id: Number(id),
                display_name: name,
                name,
                type: ClassTypeEnum.Room,
                source: RoomSource.Hive,
            }) as unknown as HiveRoom,
    );
}

export async function getAllRooms(
    controller: DatabaseController = databaseController,
    hiveUrl?: string,
    hiveCache?: HiveIterationCache,
): Promise<Array<Room>> {
    let hiveRooms: Array<HiveRoom>;
    try {
        const hiveClient = await createHiveClient(hiveUrl);
        hiveRooms = await hiveClient.getRooms();
    } catch (error) {
        // A past iteration's Hive instance may be offline. Fall back to the
        // names snapshotted when the iteration was created, rather than failing.
        if (hiveCache) {
            hiveRooms = roomsFromCache(hiveCache);
        } else {
            throw error;
        }
    }
    const customRooms: Array<CustomRoom> = (
        await controller.rooms.find({}).toArray()
    ).map((r) => ({ ...r, source: RoomSource.Custom }));

    const allRooms: Array<Room> = [...hiveRooms, ...customRooms];

    // Merge extended info onto rooms. The persisted documents store roomId and
    // roomSource as separate fields, so the composite key is derived in memory
    // on both sides — this is the migration that retired the legacy
    // `${source}-${id}` format (#544/17): both join sides now use the same
    // round-trip-safe colon format as the rest of the app.
    const extendedInfoDocs = await DbRoomExtendedInfo.getAll(controller);
    const extendedInfoMap = new Map(
        extendedInfoDocs.map((doc) => [
            roomLikeToResourceKey({
                id: doc.roomId,
                source: doc.roomSource,
            } as RoomLike),
            {
                workstationCount: doc.workstationCount,
                lectureSeatCount: doc.lectureSeatCount,
                lectureComfortable: doc.lectureComfortable,
                peAyin: doc.peAyin ?? false,
            },
        ]),
    );

    return allRooms.map((room) => {
        const key = roomLikeToResourceKey(room);
        const extInfo = extendedInfoMap.get(key);
        return extInfo ? { ...room, extendedInfo: extInfo } : room;
    });
}
