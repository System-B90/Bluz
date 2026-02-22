import { useHiveRooms } from "@/components/base/hive-rooms-provider";
import { eventHasRoom, Event } from "@/components/schedule/types/event";
import { Box, Chip, FormControl, FormControlProps, InputLabel, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { Dispatch, SetStateAction, useCallback } from "react";

interface RoomFieldProps
{
    event?: Partial<Event>;
    onEventChange: Dispatch<SetStateAction<Partial<Event>>>;
}

export default function RoomField({ event, onEventChange, ...props }: RoomFieldProps & FormControlProps)
{
    const { rooms, getRoom } = useHiveRooms();

    // Ensure value is always an array for the Select component
    const selectedRoomIds = Array.isArray(event?.rooms) ? event.rooms : [];

    const handleChange = useCallback((event: SelectChangeEvent<typeof selectedRoomIds>) =>
    {
        const {
            target: { value },
        } = event;

        // On autofill we get a stringified value.
        const newRooms = (typeof value === 'string' ? value.split(',') : value).map((v) => typeof v === 'string' ? parseInt(v) : v);

        onEventChange({ rooms: newRooms });
    }, [ onEventChange ]);

    const handleDelete = useCallback((roomIdToDelete: number) =>
    {
        onEventChange(p => { return { 'rooms': p.rooms?.filter((id) => id !== roomIdToDelete) ?? [] }; });
    }, [ onEventChange ]);

    return (
        <FormControl fullWidth={ false } { ...props } disabled={ event?.type ? !eventHasRoom(event.type) : false }>
            <InputLabel>כיתות</InputLabel>
            <Select
                label="כיתות"
                multiple
                value={ selectedRoomIds }
                onChange={ handleChange }
                renderValue={ (selected: Array<number>) => (
                    <Box sx={ { display: 'flex', flexWrap: 'wrap', gap: 0.5 } }>
                        { selected.map((value) => (
                            <Chip
                                key={ value }
                                label={ getRoom(value)?.name || value }
                                size="small" // Optional: makes them fit better
                                onDelete={ () => handleDelete(value) }
                                onMouseDown={ (event) => event.stopPropagation() }
                            />
                        )) }
                    </Box>
                ) }
            >
                { Object.values(rooms).map((room) => (
                    <MenuItem key={ room.id } value={ room.id }>
                        { room.name }
                    </MenuItem>
                )) }
            </Select>
        </FormControl>
    );
}