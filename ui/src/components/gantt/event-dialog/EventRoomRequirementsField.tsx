import FormControl, { FormControlProps } from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";

import { GanttEvent, RoomRequirement } from "@/api-shared/types/gantt/models";

export type EventRoomRequirementsFieldProps = {
    event: GanttEvent;
    commit: (updates: Partial<GanttEvent>) => void;
} & FormControlProps;

export function EventRoomRequirementsField({
    event,
    commit,
    ...props
}: EventRoomRequirementsFieldProps)
{
    return (
        <FormControl { ...props }>
            <InputLabel>דרישת חדר</InputLabel>
            <Select
                label="דרישת חדר"
                onChange={ (e) =>
                    commit({
                        roomRequirement: e.target.value as RoomRequirement,
                    })
                }
                value={ event.roomRequirement }
            >
                { Object.values(RoomRequirement).map((r) => (
                    <MenuItem key={ r } value={ r }>
                        { r }
                    </MenuItem>
                )) }
            </Select>
        </FormControl>
    );
}
