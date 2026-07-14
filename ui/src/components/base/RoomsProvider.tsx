"use client";
import { enqueueSnackbar } from "notistack";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
} from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import {
    apiCreateRoom,
    apiDeleteRoom,
    apiGetRooms,
    apiUpdateRoom,
    apiUpdateRoomExtendedInfo,
} from "@/api-client/rooms";
import {
    CustomRoom,
    HiveRoom,
    Room,
    RoomExtendedInfo,
    RoomId,
    RoomLike,
    RoomSource,
} from "@/api-shared/types/room";
import { useAuth } from "@/components/auth/AuthProvider";
import { MessageHandlerType } from "@/components/SessionWs";
import { MessageTypes } from "@/settings";

export type RoomsContextState = {
    default: boolean;
    rooms: Array<Room>;
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

const RoomsContext = createContext<RoomsContextState>({
    default: true,
    rooms: [],
    getRoom: (_id: RoomLike) => null,
    addRoom: async () => {},
    updateRoom: async () => {},
    deleteRoom: async () => {},
    updateRoomExtendedInfo: async () => {},
});

type RoomsState = {
    customRooms: Record<string, CustomRoom>;
    hiveRooms: Record<number, HiveRoom>;
    isLoading: boolean;
};
type RoomsAction =
    | { type: "ADD_CUSTOM_ROOM"; payload: CustomRoom }
    | { type: "DELETE_CUSTOM_ROOM"; payload: string }
    | {
          type: "ROLLBACK_ROOMS";
          payload: {
              custom: Record<string, CustomRoom>;
              hive: Record<number, HiveRoom>;
          };
      }
    | { type: "SET_LOADING"; payload: boolean }
    | {
          type: "SET_ROOMS";
          payload: {
              custom: Record<string, CustomRoom>;
              hive: Record<number, HiveRoom>;
          };
      }
    | { type: "UPDATE_CUSTOM_ROOM"; payload: CustomRoom }
    | {
          type: "UPDATE_EXTENDED_INFO";
          payload: {
              roomId: RoomId;
              roomSource: RoomSource;
              extendedInfo: RoomExtendedInfo;
          };
      };

function roomsReducer(state: RoomsState, action: RoomsAction): RoomsState {
    switch (action.type) {
    case "SET_LOADING":
        return { ...state, isLoading: action.payload };
    case "SET_ROOMS":
        return {
            ...state,
            customRooms: action.payload.custom,
            hiveRooms: action.payload.hive,
            isLoading: false,
        };
    case "ADD_CUSTOM_ROOM":
        return {
            ...state,
            customRooms: {
                ...state.customRooms,
                [action.payload.id]: action.payload,
            },
        };
    case "UPDATE_CUSTOM_ROOM":
        return {
            ...state,
            customRooms: {
                ...state.customRooms,
                [action.payload.id]: action.payload,
            },
        };
    case "DELETE_CUSTOM_ROOM": {
        const nextCustom = { ...state.customRooms };
        delete nextCustom[action.payload];
        return {
            ...state,
            customRooms: nextCustom,
        };
    }
    case "ROLLBACK_ROOMS":
        return {
            ...state,
            customRooms: action.payload.custom,
            hiveRooms: action.payload.hive,
        };
    case "UPDATE_EXTENDED_INFO": {
        const { roomId, roomSource, extendedInfo } = action.payload;
        if (roomSource === RoomSource.Custom) {
            const room = state.customRooms[roomId as string];
            if (!room) return state;
            return {
                ...state,
                customRooms: {
                    ...state.customRooms,
                    [roomId]: { ...room, extendedInfo },
                },
            };
        }
        if (roomSource === RoomSource.Hive) {
            const room = state.hiveRooms[roomId as number];
            if (!room) return state;
            return {
                ...state,
                hiveRooms: {
                    ...state.hiveRooms,
                    [roomId]: { ...room, extendedInfo },
                },
            };
        }
        return state;
    }
    default:
        return state;
    }
}

export const RoomsProvider = ({ children }: { children: React.ReactNode }) => {
    const { addMessageHandler } = useAuth();
    const [state, dispatch] = useReducer(roomsReducer, {
        customRooms: {},
        hiveRooms: {},
        isLoading: true,
    });

    const rooms = useMemo(
        () => [
            ...Object.values(state.customRooms),
            ...Object.values(state.hiveRooms),
        ],
        [state.customRooms, state.hiveRooms],
    );

    const getRoom = useCallback(
        (id: RoomLike) => {
            if (!(id instanceof Object)) {
                return null;
            }
            switch (id.source) {
            case RoomSource.Custom:
                return state.customRooms[id.id];
            case RoomSource.Hive:
                return state.hiveRooms[id.id];
            default:
                return null;
            }
        },
        [state.customRooms, state.hiveRooms],
    );

    const loadRooms = useCallback(() => {
        dispatch({ type: "SET_LOADING", payload: true });
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
                dispatch({
                    type: "SET_ROOMS",
                    payload: { custom: customRoomsMap, hive: hiveRoomsMap },
                });
            })
            .catch((error) => {
                dispatch({ type: "SET_LOADING", payload: false });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "טעינת חדרים נכשלה.",
                    error,
                );
            });
    }, []);

    const addRoom = useCallback(
        async (roomData: Omit<CustomRoom, "id" | "source">) => {
            const roomId = `room-${crypto.randomUUID()}`;
            const room: CustomRoom = {
                id: roomId,
                source: RoomSource.Custom,
                ...roomData,
            };
            const previousCustom = { ...state.customRooms };
            const previousHive = { ...state.hiveRooms };

            dispatch({ type: "ADD_CUSTOM_ROOM", payload: room });

            try {
                const createdRoom = await apiCreateRoom(room);
                enqueueSnackbar(`יצירת חדר ${roomData.name} הסתיימה בהצלחה.`, {
                    variant: "success",
                });
                dispatch({ type: "DELETE_CUSTOM_ROOM", payload: roomId });
                dispatch({ type: "ADD_CUSTOM_ROOM", payload: createdRoom });
            } catch (error) {
                dispatch({
                    type: "ROLLBACK_ROOMS",
                    payload: { custom: previousCustom, hive: previousHive },
                });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    `יצירת החדר ${roomData.name} נכשלה!`,
                    error,
                );
            }
        },
        [state.customRooms, state.hiveRooms],
    );

    const updateRoom = useCallback(
        async (room: CustomRoom) => {
            const previousCustom = { ...state.customRooms };
            const previousHive = { ...state.hiveRooms };

            dispatch({ type: "UPDATE_CUSTOM_ROOM", payload: room });

            try {
                const updatedRoom = await apiUpdateRoom(room);
                enqueueSnackbar(`עדכון חדר ${room.name} הסתיים בהצלחה.`, {
                    variant: "success",
                });
                dispatch({ type: "UPDATE_CUSTOM_ROOM", payload: updatedRoom });
            } catch (error) {
                dispatch({
                    type: "ROLLBACK_ROOMS",
                    payload: { custom: previousCustom, hive: previousHive },
                });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    `עדכון החדר ${room.name} נכשל!`,
                    error,
                );
            }
        },
        [state.customRooms, state.hiveRooms],
    );

    const deleteRoom = useCallback(
        async (roomId: string) => {
            const previousCustom = { ...state.customRooms };
            const previousHive = { ...state.hiveRooms };
            const deletedRoomName = state.customRooms[roomId]?.name || roomId;

            dispatch({ type: "DELETE_CUSTOM_ROOM", payload: roomId });

            try {
                await apiDeleteRoom(roomId);
                enqueueSnackbar(
                    `מחיקת חדר ${deletedRoomName} הסתיימה בהצלחה.`,
                    {
                        variant: "success",
                    },
                );
            } catch (error) {
                dispatch({
                    type: "ROLLBACK_ROOMS",
                    payload: { custom: previousCustom, hive: previousHive },
                });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    `מחיקת החדר ${deletedRoomName} נכשלה!`,
                    error,
                );
            }
        },
        [state.customRooms, state.hiveRooms],
    );

    const updateRoomExtendedInfo = useCallback(
        async (
            roomId: RoomId,
            roomSource: RoomSource,
            extendedInfo: RoomExtendedInfo,
        ) => {
            const previousCustom = { ...state.customRooms };
            const previousHive = { ...state.hiveRooms };
            const roomName =
                roomSource === RoomSource.Custom
                    ? state.customRooms[roomId as string]?.name
                    : state.hiveRooms[roomId as number]?.name;

            dispatch({
                type: "UPDATE_EXTENDED_INFO",
                payload: { roomId, roomSource, extendedInfo },
            });

            try {
                await apiUpdateRoomExtendedInfo({
                    roomId,
                    roomSource,
                    extendedInfo,
                });
                enqueueSnackbar(
                    `פרטים מורחבים של ${roomName || "חדר"} עודכנו בהצלחה.`,
                    {
                        variant: "success",
                    },
                );
            } catch (error) {
                dispatch({
                    type: "ROLLBACK_ROOMS",
                    payload: { custom: previousCustom, hive: previousHive },
                });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    `עדכון פרטים מורחבים של ${roomName || "חדר"} נכשל!`,
                    error,
                );
            }
        },
        [state.customRooms, state.hiveRooms],
    );

    useEffect(() => {
        loadRooms();
    }, [loadRooms]);

    const onWebSocketMessage: MessageHandlerType = useCallback(
        (messageType: MessageTypes, data: any) => {
            if (messageType !== MessageTypes.ROOMS_UPDATE) return;

            if (data?.rooms) {
                // Incremental update — apply payload without a full reload
                const roomMap: Record<string, CustomRoom | null> = data.rooms;
                Object.entries(roomMap).forEach(([roomId, room]) => {
                    if (room === null) {
                        dispatch({ type: "DELETE_CUSTOM_ROOM", payload: roomId });
                    } else {
                        dispatch({
                            type: "UPDATE_CUSTOM_ROOM",
                            payload: room as CustomRoom,
                        });
                    }
                });
            } else {
                // Extended-info or unknown payload — fall back to full reload
                loadRooms();
            }
        },
        [loadRooms],
    );

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        return addMessageHandler(onWebSocketMessage);
    }, [addMessageHandler, onWebSocketMessage]);

    const contextValue = useMemo(
        () => ({
            default: false as const,
            rooms,
            getRoom,
            addRoom,
            updateRoom,
            deleteRoom,
            updateRoomExtendedInfo,
        }),
        [rooms, getRoom, addRoom, updateRoom, deleteRoom, updateRoomExtendedInfo],
    );

    return (
        <RoomsContext.Provider value={contextValue}>
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
