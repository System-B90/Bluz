import { Class, ClassTypeEnum } from "@/api-server/hive/types";

export enum RoomSource
{
    Custom,
    Hive,
}

interface BaseRoom  
{
    readonly id: number | string;
    name: string;
    description?: string | null;
    source: RoomSource;
}

export interface HiveRoom extends Class, BaseRoom
{
    readonly id: number;
    readonly display_name: string;
    type: ClassTypeEnum.Room;
    source: RoomSource.Hive;
}

export interface CustomRoom extends BaseRoom  
{
    readonly id: string;
    name: string;
    description?: string | null;
    source: RoomSource.Custom;
}
export type Room = HiveRoom | CustomRoom;
export type ResolvableRoom = { id: string; source: RoomSource.Custom; } | { id: number; source: RoomSource.Hive; };
export type RoomLike = Room | ResolvableRoom;
export function areRoomsEqual(room1: RoomLike, room2: RoomLike): boolean
{
    if (!room1 || !room2) { return false; }
    if (room1 === room2) { return true; }
    return room1.id === room1.id && room1.source === room2.source;
}

export function roomToResolvable<T extends Room>(room: T): Extract<ResolvableRoom, { source: T[ "source" ]; }>
{
    return { id: room.id, source: room.source } as Extract<
        ResolvableRoom,
        { source: T[ "source" ]; }
    >;
}

export function roomToKey(room: RoomLike): string
{
    return `${room.source}-${room.id}`;
}
