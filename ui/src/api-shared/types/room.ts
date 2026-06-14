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

export function roomToKey(room: RoomLike): string {
    return `${room.source}-${room.id}`;
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
