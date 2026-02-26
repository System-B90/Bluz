import { useRooms } from "@/components/base/rooms-provider";
import { eventHasRoom, Event } from "@/components/schedule/types/event";
import { areRoomsEqual, ResolvableRoom, roomToKey, roomToResolvable } from "@/components/schedule/types/room";
import { Box, Chip, FormControl, FormControlProps, InputLabel, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { Dispatch, SetStateAction, useCallback } from "react";

interface RoomFieldProps
{
    event?: Partial<Event>;
    onEventChange: Dispatch<SetStateAction<Partial<Event>>>;
}

export default function RoomField({ event, onEventChange, ...props }: RoomFieldProps & FormControlProps)
{
    const { rooms, getRoom } = useRooms();

    const encodedSelectedRoomIds = Array.isArray(event?.rooms) ? event.rooms.map((r) => JSON.stringify(r)) : [];

    const handleChange = useCallback((event: SelectChangeEvent<typeof encodedSelectedRoomIds>) =>
    {
        const {
            target: { value },
        } = event;

        // On autofill we get a stringified value.
        const newRooms = (typeof value === 'string' ? value.split(',') : value).map((v) => typeof v === 'string' ? JSON.parse(v) as ResolvableRoom : v);

        onEventChange({ rooms: newRooms });
    }, [ onEventChange ]);

    const handleDelete = useCallback((roomIdToDelete: ResolvableRoom) =>
    {
        onEventChange(p => { return { 'rooms': p.rooms?.filter((id) => !areRoomsEqual(id, roomIdToDelete)) ?? [] }; });
    }, [ onEventChange ]);

    return (
        <FormControl fullWidth={ false } { ...props } disabled={ event?.type ? !eventHasRoom(event.type) : false }>
            <InputLabel>כיתות</InputLabel>
            <Select
                label="כיתות"
                multiple
                value={ encodedSelectedRoomIds }
                onChange={ handleChange }
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
