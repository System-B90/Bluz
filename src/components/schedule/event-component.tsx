import { useHiveRooms } from "@/components/base/hive-rooms-provider";
import { Period } from "@/components/schedule/types/event";
import { Room, RoomLike } from "@/components/schedule/types/room";
import Subject from "@/components/subject";
import { Box, Tooltip, Typography, TypographyProps } from "@mui/material";
import { useMemo } from "react";
import { EventProps } from "react-big-calendar";

export function RoomComponent({ roomId, occupancy, ...props }: { roomId: RoomLike; occupancy?: number; } & TypographyProps)
{
    const { getRoom } = useHiveRooms();
    const room = useMemo(() => getRoom(roomId), [ roomId, getRoom ]);

    const roomCapacity = room?.users.length ?? -1;
    const overcrowded = occupancy !== undefined && roomCapacity >= 0 && occupancy > roomCapacity;

    return (
        <Tooltip title={ overcrowded ? `עומס יתר: ${occupancy}/${roomCapacity}` : '' }>
            <Typography color={ overcrowded ? 'error' : '' } { ...props }>{ room?.name }</Typography>
        </Tooltip>
    );
}

export default function BluezEventComponent({ event: period }: EventProps<Period>)   
{
    return (
        <Box textAlign={ 'left' }>
            <Typography textAlign={ 'center' } variant="h6">{ period.name }</Typography>
            <Subject subjectId={ period.subject } />
            <RoomComponent occupancy={ 2 } roomId={ period.room } />
            <Box>

            </Box>
        </Box>
    );
}
