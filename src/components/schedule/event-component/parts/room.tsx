import { getHiveBaseUrl } from "@/api-shared/common";
import { useHiveRooms } from "@/components/base/hive-rooms-provider";
import { Room, RoomLike } from "@/components/schedule/types/room";
import WarningIcon from '@mui/icons-material/Warning';
import { Box, BoxProps, Chip, ChipProps, Link, Stack, Tooltip, Typography } from "@mui/material";
import { useMemo } from "react";

function SingleRoomComponent({ room, occupancy, size, ...props }: { room: Room; occupancy?: number; } & ChipProps)
{
    const roomCapacity = room?.users.length ?? -1;
    const overcrowded = occupancy !== undefined && roomCapacity >= 0 && occupancy > roomCapacity;

    return (
        <Tooltip title={ overcrowded ? `עומס יתר: ${occupancy}/${roomCapacity}` : '' }>
            <Chip size={ size ?? 'small' } { ...props } label={ <Link underline="hover" href={ `${getHiveBaseUrl()}/mentor/classes?id=${room?.id}` } color={ 'inherit' }> { room?.name }</Link> } sx={ { color: 'inherit' } } icon={ overcrowded ? <WarningIcon fontSize='small' color="warning" /> : undefined } />
        </Tooltip>
    );
}

export function RoomComponent({ roomIds, occupancy, showCaption, chipSize, ...props }: { roomIds: Array<RoomLike>; occupancy?: number; showCaption?: boolean; chipSize?: ChipProps[ 'size' ]; } & BoxProps)
{
    const { getRoom } = useHiveRooms();
    const rooms = useMemo(() => roomIds.map(getRoom).filter((v) => !!v), [ roomIds, getRoom ]);

    return (
        <Box display={ props.display ?? "flex" } flexDirection={ props.flexDirection ?? 'column' } alignItems={ props.alignItems ?? "flex-start" } gap={ 0.2 } { ...props }>
            {
                rooms.length === 0 ? <Box display={ 'flex' } flexDirection={ 'row' } alignItems={ 'center' }>
                    <WarningIcon fontSize="inherit" color="error" sx={ { verticalAlign: 'middle', mr: 0.5 } } />
                    <Typography variant="caption" color='error' fontWeight={ 600 } >אין חדר</Typography>
                </Box> :
                    <>
                        { (showCaption !== false) && <Typography variant="caption" fontWeight={ 600 } noWrap>{ roomIds.length === 1 ? 'חדר' : 'חדרים' }</Typography> }
                        < Stack display={ 'flex' } flexDirection={ props.flexDirection ?? 'row' } gap={ 0.3 } flexWrap="wrap">
                            { rooms.map((room) => <SingleRoomComponent key={ room.id } room={ room } occupancy={ occupancy } size={ chipSize } />) }
                        </Stack>
                    </>
            }
        </Box >
    );
}
export default RoomComponent;