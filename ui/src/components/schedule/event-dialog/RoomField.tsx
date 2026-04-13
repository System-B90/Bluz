import { useRooms } from "@/components/base/RoomsProvider";
import { EventFieldProps } from "@/components/schedule/event-dialog/utils";
import { eventHasRoom } from "@/components/schedule/types/event";
import { areRoomsEqual, ResolvableRoom, roomToKey, roomToResolvable } from "@/components/schedule/types/room";
import { Box, Chip, FormControl, FormControlProps, InputLabel, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { useCallback, useState } from "react";

interface RoomFieldProps extends EventFieldProps { };

export default function RoomField({ event, onBlurCallback, ...props }: RoomFieldProps & FormControlProps)
{
    const { rooms, getRoom } = useRooms();
    const [ encodedSelectedRoomIds, setEncodedSelectedRoomIds ] = useState(Array.isArray(event?.rooms) ? event.rooms.map((r) => JSON.stringify(r)) : []);

    const handleChange = useCallback((event: SelectChangeEvent<typeof encodedSelectedRoomIds>) =>
    {
        const {
            target: { value },
        } = event;

        // On autofill we get a stringified value.
        const newRooms = (typeof value === 'string' ? value.split(',') : value);

        setEncodedSelectedRoomIds(newRooms);
    }, []);

    const handleDelete = useCallback((roomIdToDelete: ResolvableRoom) =>
    {
        setEncodedSelectedRoomIds(p => p.filter((id) => !areRoomsEqual(JSON.parse(id) as ResolvableRoom, roomIdToDelete)) ?? []);
    }, []);

    const onClose = useCallback(() =>
    {
        onBlurCallback({ rooms: encodedSelectedRoomIds.map((v) => JSON.parse(v) as ResolvableRoom) });
    }, [ encodedSelectedRoomIds, onBlurCallback ]);

    return (
        <FormControl fullWidth={ false } { ...props } disabled={ event?.type ? !eventHasRoom(event.type) : false }>
            <InputLabel>כיתות</InputLabel>
            <Select
                label="כיתות"
                multiple
                value={ encodedSelectedRoomIds }
                onChange={ handleChange }
                onClose={ onClose }
                renderValue={ (selected: Array<string>) => (
                    <Box sx={ { display: 'flex', flexWrap: 'wrap', gap: 0.5 } }>
                        { selected.map((encodedValue) => JSON.parse(encodedValue) as ResolvableRoom).map((value) => (
                            <Chip
                                key={ roomToKey(value) }
                                label={ getRoom(value)?.name || value.id }
                                size="small" // Optional: makes them fit better
                                onDelete={ () => handleDelete(value) }
                                onMouseDown={ (event) => event.stopPropagation() }
                            />
                        )) }
                    </Box>
                ) }
            >
                { Object.values(rooms).map((room) => (
                    <MenuItem key={ roomToKey(room) } value={ JSON.stringify(roomToResolvable(room)) }>
                        { room.name }
                    </MenuItem>
                )) }
            </Select>
        </FormControl>
    );
}
