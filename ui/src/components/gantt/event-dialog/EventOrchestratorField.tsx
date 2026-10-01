import FormControl, { FormControlProps } from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import { SelectChangeEvent } from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import { useCallback, useId } from "react";

import { GanttEvent } from "@/api-shared/types/gantt/models/event";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { InstructorSelect } from "@/components/base/InstructorSelect";

export type EventOrchestratorFieldProps = {
    event: GanttEvent;
    commit: (updates: Partial<GanttEvent>) => void;
    leadInstructorIds: Array<number>;
} & FormControlProps;

export function EventOrchestratorField({
    event,
    commit,
    leadInstructorIds,
    ...props
}: EventOrchestratorFieldProps)
{
    const labelId = useId();
    const { getInstructor } = useHiveUsers();
    const onChange = useCallback(
        (e: SelectChangeEvent<"" | number>) =>
        {
            const val = e.target.value;
            commit({
                orchestratorId: val === "" ? null : Number(val),
            });
        },
        [ commit ]
    );

    const isMissing = event.orchestratorId === null;

    return (
        <FormControl size="small" { ...props }>
            <InputLabel id={ labelId } shrink sx={ isMissing ? { color: "warning.main" } : undefined }>
                אחראי
            </InputLabel>
            <InstructorSelect<"" | number>
                displayEmpty
                excludeTeachers={ true }
                label="אחראי"
                labelId={ labelId }
                notched
                onChange={ onChange }
                pinnedIds={ leadInstructorIds }
                renderValue={ (value) => value === ""
                    ? (
                        <Typography color="warning.main" component="span" variant="body2">
                            מומלץ מאוד להגדיר אחראי מבין המדריכים
                        </Typography>
                    )
                    : (getInstructor(Number(value))?.display_name ?? `#${value}`) }
                sx={ isMissing
                    ? {
                        "& .MuiOutlinedInput-notchedOutline": {
                            borderColor: "warning.main",
                        },
                    }
                    : undefined }
                value={ event.orchestratorId ?? "" }
            >
                <MenuItem value="">
                    <em>ללא אחראי</em>
                </MenuItem>
            </InstructorSelect>
        </FormControl>
    );
}
