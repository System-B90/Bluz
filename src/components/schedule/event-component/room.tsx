import { getHiveBaseUrl } from "@/api-client/hive";
import { useHiveRooms } from "@/components/base/hive-rooms-provider";
import { Room, RoomLike } from "@/components/schedule/types/room";
import WarningIcon from '@mui/icons-material/Warning';
import { Box, BoxProps, Chip, ChipProps, Link, Tooltip, Typography } from "@mui/material";
import { useMemo } from "react";

function SingleRoomComponent({ room, occupancy, size, ...props }: { room: Room; occupancy?: number; } & ChipProps)
{
    const roomCapacity = room?.users.length ?? -1;
    const overcrowded = occupancy !== undefined && roomCapacity >= 0 && occupancy > roomCapacity;

    return (
        <Tooltip title={ overcrowded ? `עומס יתר: ${occupancy}/${roomCapacity}` : '' }>
            <Chip size={ size ?? 'small' } { ...props } label={ <Link underline="hover" href={ `${getHiveBaseUrl()}/mentor/classes?id=${room?.id}` } color={ 'textPrimary' }> { room?.name }</Link> } sx={ { color: 'inherit' } } icon={ overcrowded ? <WarningIcon fontSize='small' color="warning" /> : undefined } />
        </Tooltip>
    );
}

export function RoomComponent({ roomIds, occupancy, showCaption, chipSize, ...props }: { roomIds: Array<RoomLike>; occupancy?: number; showCaption?: boolean; chipSize?: ChipProps[ 'size' ]; } & BoxProps)
{
    const { getRoom } = useHiveRooms();
    const rooms = useMemo(() => roomIds.map(getRoom).filter((v) => !!v), [ roomIds, getRoom ]);

    return (
        <Box display="flex" flexDirection={ 'column' } alignItems="flex-start" gap={ 0.2 } { ...props }>
            {
                rooms.length === 0 ? <Box display={ 'flex' } flexDirection={ 'row' } alignItems={ 'center' }>
                    <WarningIcon fontSize="inherit" color="error" sx={ { verticalAlign: 'middle', mr: 0.5 } } />
                    <Typography variant="caption" color='error' fontWeight={ 600 } >אין חדר</Typography>
                </Box> :
                    <>
                        { (showCaption !== false) && <Typography variant="caption" fontWeight={ 600 } noWrap>{ roomIds.length === 1 ? 'חדר' : 'חדרים' }</Typography> }
                        < Box display={ 'flex' } gap={ 1 } flexWrap="wrap">
                            { rooms.map((room) => <SingleRoomComponent key={ room.id } room={ room } occupancy={ occupancy } size={ chipSize } />) }
                        </Box>
                    </>
            }
        </Box >
    );
}
export default RoomComponent;