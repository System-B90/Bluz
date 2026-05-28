"use client";
import { enqueueSnackbar } from "notistack";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { apiGetRooms } from "@/api-client/rooms";
import {
    CustomRoom,
    HiveRoom,
    Room,
    RoomLike,
    RoomSource,
} from "@/api-shared/types/room";

export type RoomsContextState = {
  default: boolean;
  rooms: Array<Room>;
  getRoom: (id: RoomLike) => null | Room;
};

const RoomsContext = createContext<RoomsContextState>({
    default: true,
    rooms: [],
    getRoom: (_id: RoomLike) => null,
});

export const RoomsProvider = ({ children }: { children: React.ReactNode }) => {
    const [customRoomLookup, setCustomRoomLookup] = useState<
    Record<string, CustomRoom>
  >({});
    const [hiveRoomLookup, setHiveRoomLookup] = useState<
    Record<number, HiveRoom>
  >({});

    const rooms = useMemo(
        () => [
            ...Object.values(customRoomLookup),
            ...Object.values(hiveRoomLookup),
        ],
        [customRoomLookup, hiveRoomLookup],
    );

    const getRoom = useCallback(
        (id: RoomLike) => {
            if (!(id instanceof Object)) {
                return null;
            }
            switch (id.source) {
            case RoomSource.Custom:
                return customRoomLookup[id.id];
            case RoomSource.Hive:
                return hiveRoomLookup[id.id];
            default:
                return null;
            }
        },
        [customRoomLookup, hiveRoomLookup],
    );

    const loadRooms = useCallback(() => {
        apiGetRooms()
            .then((fetchedRooms) => {
                const customRoomsMap: Record<string, CustomRoom> = {};
                const hiveRoomsMap: Record<number, HiveRoom> = {};
                fetchedRooms.forEach((room) => {
                    switch (room.source) {
                    case RoomSource.Custom:
                        customRoomsMap[room.id] = room;
                        break;
                    case RoomSource.Hive:
                        hiveRoomsMap[room.id] = room;
                        break;
                    }
                });
                setCustomRoomLookup(customRoomsMap);
                setHiveRoomLookup(hiveRoomsMap);
            })
            .catch((error) =>
                enqueueApiErrorSnackbar(enqueueSnackbar, "טעינת חדרים נכשלה.", error),
            );
    }, []);

    useEffect(() => {
        loadRooms();
    }, [loadRooms]);

    return (
        <RoomsContext.Provider
            value={{
                default: false,
                rooms,
                getRoom,
            }}
        >
            {children}
        </RoomsContext.Provider>
    );
};

export const useRooms = () => {
    const context = useContext(RoomsContext);

    if (context === undefined || context.default) {
        throw new Error("useRooms must be used within an RoomsProvider");
    }

    return context;
};
