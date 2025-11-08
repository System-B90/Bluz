import {DEFAULT_INSTRUCTORS, DEFAULT_ROOMS, EVENT_TYPES} from "@/components/schedule/types/types";
import {Autocomplete, Chip, FormControl, InputLabel, MenuItem, Select, TextField} from "@mui/material";
import {Period} from "@/components/schedule/types/event";

interface RoomFieldProps {
    period?: Partial<Period>;
    onPeriodChange: (updates: Partial<Period>) => void;
}

export default function RoomField({period, onPeriodChange}: RoomFieldProps) {
    return (
        <FormControl fullWidth>
            <InputLabel>Room</InputLabel>
            <Select
                value={period?.room || ""}
                label="Room"
                onChange={(e) => onPeriodChange({room: e.target.value})}
            >
                {DEFAULT_ROOMS.map((room) => (
                    <MenuItem key={room.id} value={room.id}>
                        {room.name}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )
}