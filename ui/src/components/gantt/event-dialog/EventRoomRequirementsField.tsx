import FormControl, { FormControlProps } from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useId } from "react";

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
    const labelId = useId();
    return (
        <FormControl { ...props }>
            <InputLabel id={ labelId }>דרישת חדר</InputLabel>
            <Select label="דרישת חדר"
                labelId={ labelId }
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
