"use client";
import { useCallback, useMemo } from "react";

import {
    apiCreateRoom,
    apiDeleteRoom,
    apiGetRooms,
    apiUpdateRoom,
    apiUpdateRoomExtendedInfo,
} from "@/api-client/rooms";
import {
    CustomRoom,
    Room,
    RoomExtendedInfo,
    RoomId,
    RoomLike,
    roomLikeToResourceKey,
    RoomSource,
} from "@/api-shared/types/room";
import { createCollectionProvider } from "@/components/base/collection/create-collection-provider";
import { MessageTypes } from "@/settings";

export type RoomsContextState = {
    default: boolean;
    rooms: Array<Room>;
    isLoading: boolean;
    getRoom: (id: RoomLike) => null | Room;
    addRoom: (roomData: Omit<CustomRoom, "id" | "source">) => Promise<void>;
    updateRoom: (room: CustomRoom) => Promise<void>;
    deleteRoom: (roomId: string) => Promise<void>;
    updateRoomExtendedInfo: (
        roomId: RoomId,
        roomSource: RoomSource,
        extendedInfo: RoomExtendedInfo,
    ) => Promise<void>;
};

const customRoomKey = (id: string) =>
    roomLikeToResourceKey({ id, source: RoomSource.Custom });

// Only custom rooms are writable — hive rooms are read-only mirrors of Hive —
// so the create/update/delete api entries narrow `Room` down to `CustomRoom`.
const { Provider, useCollection } = createCollectionProvider<
    Room,
    RoomId,
    Omit<CustomRoom, "id" | "source">
>({
    api: {
        list: apiGetRooms,
        create: (room) => apiCreateRoom(room as CustomRoom),
        update: (room) => apiUpdateRoom(room as CustomRoom),
        remove: (roomId) => apiDeleteRoom(roomId as string),
    },
    getKey: roomLikeToResourceKey,
    getId: (room) => room.id,
    getLabel: (room) => room.name,
    buildItem: (data) => ({
        id: `room-${crypto.randomUUID()}`,
        source: RoomSource.Custom,
        ...data,
    }),
    messages: {
        loadFailed: "טעינת חדרים נכשלה.",
        createSuccess: (name) => `יצירת חדר ${name} הסתיימה בהצלחה.`,
        createFailure: (name) => `יצירת החדר ${name} נכשלה!`,
        updateSuccess: (name) => `עדכון חדר ${name} הסתיים בהצלחה.`,
        updateFailure: (name) => `עדכון החדר ${name} נכשל!`,
        deleteSuccess: (name) => `מחיקת חדר ${name} הסתיימה בהצלחה.`,
        deleteFailure: (name) => `מחיקת החדר ${name} נכשלה!`,
    },
    websocket: {
        messageType: MessageTypes.ROOMS_UPDATE,
        payloadKey: "rooms",
        // The incremental map is keyed by raw custom-room id; a deleted room has
        // no body left to derive its source from.
        keyOf: (id, room) =>
            room ? roomLikeToResourceKey(room) : customRoomKey(id),
    },
});

export const RoomsProvider = Provider;

export const useRooms = (): RoomsContextState => {
    const collection = useCollection("useRooms");
    const { getItem, deleteItem, mutate } = collection;

    const getRoom = useCallback(
        (id: RoomLike) => {
            if (!(id instanceof Object)) {
                return null;
            }
            return getItem(roomLikeToResourceKey(id)) ?? null;
        },
        [getItem],
    );

    const deleteRoom = useCallback(
        (roomId: string) => deleteItem(customRoomKey(roomId)),
        [deleteItem],
    );

    const updateRoomExtendedInfo = useCallback(
        async (
            roomId: RoomId,
            roomSource: RoomSource,
            extendedInfo: RoomExtendedInfo,
        ) => {
            const key = roomLikeToResourceKey({
                id: roomId,
                source: roomSource,
            } as RoomLike);
            const roomName = getItem(key)?.name || "חדר";

            await mutate({
                optimistic: (ops) => ops.patch(key, { extendedInfo }),
                request: () =>
                    apiUpdateRoomExtendedInfo({
                        roomId,
                        roomSource,
                        extendedInfo,
                    }),
                successMessage: `פרטים מורחבים של ${roomName} עודכנו בהצלחה.`,
                failureMessage: `עדכון פרטים מורחבים של ${roomName} נכשל!`,
            });
        },
        [getItem, mutate],
    );

    return useMemo(
        () => ({
            default: false,
            rooms: collection.items,
            isLoading: collection.isLoading,
            getRoom,
            addRoom: collection.addItem,
            updateRoom: collection.updateItem,
            deleteRoom,
            updateRoomExtendedInfo,
        }),
        [collection, getRoom, deleteRoom, updateRoomExtendedInfo],
    );
};
