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
 * Legacy room key: `${source}-${id}`. #544/17 — do NOT extend this format's
 * usage, and do not "just" switch it to the colon format below; that is a
 * data migration, not a local edit. Left in place, documented, for whoever
 * picks up that migration. Two call sites left as of this writing:
 *
 * - `app/api/rooms/utils.ts` (`getAllRoomsWithExtendedInfo`) — builds this
 *   exact string to look up `DbRoomExtendedInfo` documents, which are
 *   *persisted* keyed by `${roomSource}-${roomId}` (see that file's
 *   `extendedInfoMap`, built straight from `doc.roomSource`/`doc.roomId`).
 *   This is the real hazard: the dash format isn't just an in-memory key,
 *   it's baked into existing Mongo documents. Swapping the format here
 *   without also migrating (or dual-writing/dual-reading) those documents
 *   silently orphans every room's existing extended info (workstation/seat
 *   counts, "peAyin") — they'd stop resolving, not error.
 * - `components/schedule/event-dialog/RoomField.tsx` — uses it only as a
 *   React list `key` prop. Cosmetic; safe to repoint at
 *   `roomLikeToResourceKey` any time, independent of the above.
 *
 * The round-trip hazard `roomLikeToResourceKey` was introduced to fix
 * (#170) applies here too, in a different way: `roomToKey` has no inverse —
 * nothing parses `"1-<uuid-with-dashes>"` back apart — so it has stayed
 * safe only because every caller re-derives the key from a live `Room`
 * instead of storing then re-parsing it. A migration needs to either (a)
 * backfill `DbRoomExtendedInfo` to a colon-keyed (or structured
 * source+id) lookup and cut this function over in the same change, or
 * (b) teach the lookup to fall back from colon to dash format during a
 * transition window, then remove the fallback once confirmed backfilled.
 * Either way, this is a server-side (api-server / app/api) + data change,
 * not something to do from api-client/api-shared alone.
 */
export function roomToKey(room: RoomLike): string {
    return `${room.source}-${room.id}`;
}

/**
 * Stable composite key for matching a room across the calendar resource layer
 * (react-big-calendar `resourceIdAccessor` / `resourceAccessor`). Uses a `:`
 * separator so the key round-trips unambiguously even when the room id itself
 * contains `-` (custom-room UUIDs, the "no-room" sentinel). Replaces the old
 * `JSON.stringify(room)` matching, which was fragile to property order / extra
 * fields and could silently drop events into the "no room" column (#170).
 * This is the current, production-standard key format — prefer it over
 * {@link roomToKey} everywhere except the one persisted-data call site
 * documented on that function.
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
