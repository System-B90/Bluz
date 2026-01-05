import { useHiveRooms } from "@/components/base/hive-rooms-provider";
import { Period } from "@/components/schedule/types/event";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";

interface RoomFieldProps
{
    period?: Partial<Period>;
    onPeriodChange: (updates: Partial<Period>) => void;
}

export default function RoomField({ period, onPeriodChange }: RoomFieldProps)
{
    const { rooms } = useHiveRooms();

    const roomMenuItems = Object.values(rooms).map((room) => (
        <MenuItem key={ room.id } value={ room.id }>
            { room.name }
        </MenuItem>
    ));

    return (
        <FormControl fullWidth>
            <InputLabel>כיתה</InputLabel>
            <Select
                value={ period?.room || "" }
                label="כיתה"
                onChange={ (e) => onPeriodChange({ room: e.target.value }) }
            >
                { roomMenuItems }
            </Select>
        </FormControl>
    );
}