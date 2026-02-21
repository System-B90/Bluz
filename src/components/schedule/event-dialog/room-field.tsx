import { useHiveRooms } from "@/components/base/hive-rooms-provider";
import { eventHasRoom, Period } from "@/components/schedule/types/event";
import { Box, Chip, FormControl, FormControlProps, InputLabel, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { Dispatch, SetStateAction, useCallback } from "react";

interface RoomFieldProps
{
    period?: Partial<Period>;
    onPeriodChange: Dispatch<SetStateAction<Partial<Period>>>;
}

export default function RoomField({ period, onPeriodChange, ...props }: RoomFieldProps & FormControlProps)
{
    const { rooms, getRoom } = useHiveRooms();

    // Ensure value is always an array for the Select component
    const selectedRoomIds = Array.isArray(period?.rooms) ? period.rooms : [];

    const handleChange = useCallback((event: SelectChangeEvent<typeof selectedRoomIds>) =>
    {
        const {
            target: { value },
        } = event;

        // On autofill we get a stringified value.
        const newRooms = (typeof value === 'string' ? value.split(',') : value).map((v) => typeof v === 'string' ? parseInt(v) : v);

        onPeriodChange({ rooms: newRooms });
    }, [ onPeriodChange ]);

    const handleDelete = useCallback((roomIdToDelete: number) =>
    {
        onPeriodChange(p => { return { 'rooms': p.rooms?.filter((id) => id !== roomIdToDelete) ?? [] }; });
    }, [ onPeriodChange ]);

    return (
        <FormControl fullWidth={ false } { ...props } disabled={ period?.type ? !eventHasRoom(period.type) : false }>
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