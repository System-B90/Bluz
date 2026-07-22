import Box, { BoxProps } from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import { SelectChangeEvent } from "@mui/material/Select";
import Select from "@mui/material/Select";

import { roomLikeToResourceKey } from "@/api-shared/types/room";
import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { useRooms } from "@/components/base/RoomsProvider";

export function FilterRoom({ ...props }: BoxProps) {
    const { rooms } = useRooms();
    const { filteredRoom, setFilteredRoom } = useCalendarFilters();

    const handleChange = (event: SelectChangeEvent<string>) => {
        const value = event.target.value;
        setFilteredRoom(value === "" ? null : value);
    };

    return (
        <Box {...props}>
            <FormControl fullWidth={true} size="small">
                <InputLabel size="small">סינון לפי חדר</InputLabel>
                <Select
                    label="סינון לפי חדר"
                    MenuProps={{ disablePortal: true }}
                    onChange={handleChange}
                    size="small"
                    value={filteredRoom ?? ""}
                >
                    <MenuItem value="">כל החדרים</MenuItem>
                    {rooms.map((room) => (
                        <MenuItem
                            key={roomLikeToResourceKey(room)}
                            value={roomLikeToResourceKey(room)}
                        >
                            {room.name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Box>
    );
}
