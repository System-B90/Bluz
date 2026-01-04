import { DEFAULT_ROOMS } from "@/components/schedule/types/types";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { Period } from "@/components/schedule/types/event";

interface RoomFieldProps
{
    period?: Partial<Period>;
    onPeriodChange: (updates: Partial<Period>) => void;
}

export default function RoomField({ period, onPeriodChange }: RoomFieldProps)
{
    return (
        <FormControl fullWidth>
            <InputLabel>Room</InputLabel>
            <Select
                value={ period?.room || "" }
                label="Room"
                onChange={ (e) => onPeriodChange({ room: e.target.value }) }
            >
                { DEFAULT_ROOMS.map((room) => (
                    <MenuItem key={ room.id } value={ room.id }>
                        { room.name }
                    </MenuItem>
                )) }
            </Select>
        </FormControl>
    );
}