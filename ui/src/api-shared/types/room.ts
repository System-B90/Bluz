import { Class, ClassTypeEnum } from "@/api-shared/types/hive";

export enum RoomSource {
    Custom,
    Hive,
}

export type RoomId = number | string;

export type RoomExtendedInfo = {
    workstationCount: null | number;
    lectureSeatCount: null | number;
    lectureComfortable: boolean;
    peAyin: boolean;
};

type BaseRoom = {
    readonly id: RoomId;
    name: string;
    description?: null | string;
    source: RoomSource;
    extendedInfo?: RoomExtendedInfo;
};

export type HiveRoom = {
    readonly id: number;
    readonly display_name: string;
    type: ClassTypeEnum.Room;
    source: RoomSource.Hive;
} & Class &
    BaseRoom;

export type CustomRoom = {
    readonly id: string;
    name: string;
    description?: null | string;
    source: RoomSource.Custom;
} & BaseRoom;

export type Room = CustomRoom | HiveRoom;

export type ResolvableRoom =
    | { id: number; source: RoomSource.Hive }
    | { id: string; source: RoomSource.Custom };

export type RoomLike = ResolvableRoom | Room;

export function areRoomsEqual(room1: RoomLike, room2: RoomLike): boolean {
    if (!room1 || !room2) {
        return false;
    }
    if (room1 === room2) {
        return true;
    }
    return room1.id === room2.id && room1.source === room2.source;
}

export function roomToResolvable<T extends Room>(
    room: T,
): Extract<ResolvableRoom, { source: T["source"] }> {
    return { id: room.id, source: room.source } as Extract<
        ResolvableRoom,
        { source: T["source"] }
    >;
}

/**
 * Stable composite key for matching a room across the calendar resource layer
 * (react-big-calendar `resourceIdAccessor` / `resourceAccessor`). Uses a `:`
 * separator so the key round-trips unambiguously even when the room id itself
 * contains `-` (custom-room UUIDs, the "no-room" sentinel). Replaces the old
 * `JSON.stringify(room)` matching, which was fragile to property order / extra
 * fields and could silently drop events into the "no room" column (#170).
 *
 * This is the only room-key format in the codebase. The legacy
 * `${source}-${id}` format it once coexisted with (#544/17) was retired:
 * its last consumers — the extended-info join in `app/api/rooms/utils.ts`,
 * two cosmetic React keys, and an unconsumed WS broadcast key — all derived
 * the string in memory from structured data (the persisted
 * `DbRoomExtendedInfo` documents store roomId/roomSource as separate
 * fields), so cutting them over needed no data backfill.
 */
export function roomLikeToResourceKey(room: RoomLike): string {
    return `${room.source}:${room.id}`;
}

/**
 * Inverse of {@link roomLikeToResourceKey}. Splits on the first `:` only, so
 * ids containing further separators survive intact. Hive ids are numeric and
 * are coerced back to `number` to match {@link ResolvableRoom}.
 */
export function resourceKeyToResolvable(key: string): ResolvableRoom {
    const sep = key.indexOf(":");
    const source = Number(key.slice(0, sep)) as RoomSource;
    const rawId = key.slice(sep + 1);
    return source === RoomSource.Hive
        ? { id: Number(rawId), source: RoomSource.Hive }
        : { id: rawId, source: RoomSource.Custom };
}

export type ApiRoomsGetPayload = void;
export type ApiRoomsGetResponse = Array<Room>;

export type ApiRoomCreatePayload = CustomRoom;
export type ApiRoomCreateResponse = CustomRoom;

export type ApiRoomUpdatePayload = CustomRoom;
export type ApiRoomUpdateResponse = CustomRoom;

export type ApiRoomDeletePayload = CustomRoom["id"];
export type ApiRoomDeleteResponse = void;

export type ApiRoomExtendedInfoUpdatePayload = {
    roomId: RoomId;
    roomSource: RoomSource;
    extendedInfo: RoomExtendedInfo;
};
export type ApiRoomExtendedInfoUpdateResponse = void;
