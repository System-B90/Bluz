import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack, { StackProps } from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { EventRecurrence, GanttEvent } from "@/api-shared/types/gantt/models";

export const RECURRENCE_LABELS: Record<EventRecurrence, string> = {
    [ EventRecurrence.None ]: "ללא",
    [ EventRecurrence.Daily ]: "יומי",
    [ EventRecurrence.Weekly ]: "שבועי",
};

const RECURRENCE_HINTS: Record<EventRecurrence, string> = {
    [ EventRecurrence.None ]: "",
    [ EventRecurrence.Daily ]: "המופע יחזור מדי יום.",
    [ EventRecurrence.Weekly ]: "המופע יחזור בכל שבוע בגאנט.",
};

export type EventRecurrenceFieldProps = {
    event: GanttEvent;
    commit: (updates: Partial<GanttEvent>) => void;
} & Omit<StackProps, 'spacing'>;

export function EventRecurrenceField({
    event,
    commit,
    ...props
}: EventRecurrenceFieldProps)
{
    return (
        <Stack spacing={ 1 } { ...props }>
            <FormControl fullWidth size="small">
                <InputLabel>חזרה</InputLabel>
                <Select
                    label="חזרה"
                    onChange={ (e) =>
                        commit({ recurrence: e.target.value as EventRecurrence })
                    }
                    value={ event.recurrence }
                >
                    { Object.values(EventRecurrence).map((r) => (
                        <MenuItem key={ r } value={ r }>
                            { RECURRENCE_LABELS[ r ] }
                        </MenuItem>
                    )) }
                </Select>
            </FormControl>
            { /* Recurrence window (#468): the echo no longer has to start in the
                 first week, and can be stopped before the course ends. Both
                 bounds are optional — empty means unbounded in that direction. */ }
            { event.recurrence !== EventRecurrence.None && (
                <Stack direction="row" spacing={ 1 }>
                    <TextField
                        fullWidth
                        InputLabelProps={ { shrink: true } }
                        label="תחילת חזרתיות"
                        onChange={ (e) =>
                            commit({ recurrenceStartDate: e.target.value || null })
                        }
                        size="small"
                        type="date"
                        value={ event.recurrenceStartDate ?? "" }
                    />
                    <TextField
                        fullWidth
                        InputLabelProps={ { shrink: true } }
                        label="סיום חזרתיות"
                        onChange={ (e) =>
                            commit({ recurrenceEndDate: e.target.value || null })
                        }
                        size="small"
                        type="date"
                        value={ event.recurrenceEndDate ?? "" }
                    />
                </Stack>
            ) }
            { /* Always rendered so the section height stays constant when
                 switching recurrence — an empty line reserves the space. */ }
            <Typography
                color="text.secondary"
                sx={ { minHeight: "1.5em" } }
                variant="caption"
            >
                { RECURRENCE_HINTS[ event.recurrence ] }
            </Typography>
        </Stack>
    );
}
