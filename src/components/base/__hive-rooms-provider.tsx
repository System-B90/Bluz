'use client';
import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { apiGetHiveRooms } from '@/api-client/hive';
import { HiveRoom, RoomLike } from '@/components/schedule/types/room';
import { enqueueSnackbar } from 'notistack';
import
{
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';


export type HiveRoomsContextState = {
    default: boolean;
    rooms: Array<HiveRoom>;
    getRoom: (id: RoomLike) => HiveRoom | undefined;
};

const HiveRoomsContext = createContext<HiveRoomsContextState | undefined>({
    default: true,
    rooms: [],
    getRoom: (_id: RoomLike) => undefined
});

export const HiveRoomsProvider = ({ children }: { children: React.ReactNode; }) =>
{
    const [ roomLookup, setRoomLookup ] = useState<Record<string, HiveRoom>>({});

    const rooms = useMemo(() => Object.values(roomLookup), [ roomLookup ]);

    const getRoom = useCallback((id: RoomLike) =>
    {
        const roomId = id instanceof Object ? id.id : id as number;
        return roomLookup[ roomId ];
    }, [ roomLookup ]);

    const loadRooms = useCallback(() =>
    {
        apiGetHiveRooms().then((fetchedRooms) =>
        {
            const roomsMap: Record<string, HiveRoom> = {};
            fetchedRooms.forEach((room) =>
            {
                roomsMap[ room.id ] = room;
            });
            setRoomLookup(roomsMap);
        }).catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'טעינת חדרים מההייב נכשלה.', error));
    }, [ setRoomLookup ]);

    useEffect(() =>
    {
        loadRooms();
    }, [ loadRooms ]);

    return (
        <HiveRoomsContext.Provider value={ {
            default: false,
            rooms,
            getRoom,
        } }>
            { children }
        </HiveRoomsContext.Provider>
    );
};

export const useHiveRooms = () =>
{
    const context = useContext(HiveRoomsContext);

    if (context === undefined || context.default)
    {
        throw new Error('useHiveRooms must be used within an HiveRoomsProvider');
    }

    return context;
};
