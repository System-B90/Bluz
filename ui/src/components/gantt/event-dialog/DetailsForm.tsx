import { EventRecurrence, GanttEvent, ModuleEventType, RoomRequirement } from "@/api-shared/types/gantt/models";
import { NumberSpinner } from "@/components/base/NumberSpinner";
import { ShuffleSelect } from "@/components/gantt/ShuffleSelect";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

const RECURRENCE_LABELS: Record<EventRecurrence, string> = {
    [ EventRecurrence.None ]: "ללא",
    [ EventRecurrence.Daily ]: "יומי",
    [ EventRecurrence.Weekly ]: "שבועי",
};

export function EventDetailsForm({
    event,
    localTitle,
    localComment,
    setLocalTitle,
    setLocalComment,
    commit,
    shuffleOptions,
}: {
    event: GanttEvent;
    localTitle: string;
    localComment: string;
    setLocalTitle: (v: string) => void;
    setLocalComment: (v: string) => void;
    commit: (updates: Partial<GanttEvent>) => void;
    shuffleOptions: Array<string>;
})
{
    return (
        <Stack spacing={ 2 } width="32%">
            <TextField
                fullWidth
                label="שם"
                onBlur={ () =>
                {
                    if (localTitle !== event.title) commit({ title: localTitle });
                } }
                onChange={ (e) => setLocalTitle(e.target.value) }
                value={ localTitle }
            />

            <FormControl fullWidth>
                <InputLabel>סוג</InputLabel>
                <Select
                    label="סוג"
                    onChange={ (e) =>
                        commit({ type: e.target.value as ModuleEventType })
                    }
                    value={ event.type }
                >
                    { Object.values(ModuleEventType).map((t) => (
                        <MenuItem key={ t } value={ t }>
                            { t }
                        </MenuItem>
                    )) }
                </Select>
            </FormControl>

            <Box>
                <Typography color="text.secondary" variant="caption">
                    זמן מינימלי (דק&apos;)
                </Typography>
                <NumberSpinner
                    largeStep={ 45 }
                    onValueChange={ (v) =>
                        v ? commit({ minimumDuration: v }) : undefined
                    }
                    step={ 5 }
                    value={ event.minimumDuration }
                />
            </Box>

            <FormControl fullWidth>
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

            <FormControl fullWidth>
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
            { event.recurrence === EventRecurrence.Weekly && (
                <Typography color="text.secondary" variant="caption">
                    המופע יחזור בכל שבוע בגאנט.
                </Typography>
            ) }
            { event.recurrence === EventRecurrence.Daily && (
                <Typography color="text.secondary" variant="caption">
                    המופע יחזור מדי יום.
                </Typography>
            ) }

            <Box display="flex" gap={ 2 }>
                <FormControlLabel
                    control={
                        <Switch
                            checked={ event.isCritical }
                            onChange={ (e) =>
                                commit({ isCritical: e.target.checked })
                            }
                        />
                    }
                    label="קריטי"
                />
                <FormControlLabel
                    control={
                        <Switch
                            checked={ event.isPaWindow }
                            onChange={ (e) =>
                                commit({ isPaWindow: e.target.checked })
                            }
                        />
                    }
                    label='חלון פ"א'
                />
            </Box>

            <ShuffleSelect
                onChange={ (shuffles) => commit({ shuffles }) }
                options={ shuffleOptions }
                value={ event.shuffles ?? [] }
            />

            <TextField
                fullWidth
                label="הערה"
                minRows={ 3 }
                multiline
                onBlur={ () =>
                {
                    const next = localComment.trim() === "" ? null : localComment;
                    if (next !== event.comment) commit({ comment: next });
                } }
                onChange={ (e) => setLocalComment(e.target.value) }
                value={ localComment }
            />
        </Stack>
    );
}