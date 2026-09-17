import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import FormControl, { FormControlProps } from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import { SelectChangeEvent } from "@mui/material/Select";
import { useCallback, useId } from "react";

import { GanttEvent } from "@/api-shared/types/gantt/models/event";
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
            <InputLabel id={ labelId } sx={ isMissing ? { color: "warning.main" } : undefined }>
                אחראי
            </InputLabel>
            <InstructorSelect<"" | number>
                excludeTeachers={ true }
                label="אחראי"
                labelId={ labelId }
                onChange={ onChange }
                pinnedIds={ leadInstructorIds }
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
            { isMissing ? <FormHelperText
                component="div"
                sx={ {
                    alignItems: "center",
                    color: "warning.main",
                    display: "flex",
                    gap: 0.5,
                    marginInline: 0,
                } }
            >
                <WarningAmberIcon sx={ { fontSize: 14 } } />
                    מומלץ מאוד להגדיר אחראי מבין המדריכים
            </FormHelperText> : null }
        </FormControl>
    );
}
