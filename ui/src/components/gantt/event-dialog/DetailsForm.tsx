import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { useId } from "react";

import
{
    defaultModuleEventSplitAcrossBreaks,
    GanttEvent,
    ModuleEventType,
} from "@/api-shared/types/gantt/models";
import { NumberSpinner } from "@/components/base/NumberSpinner";
import { EventOrchestratorField } from "@/components/gantt/event-dialog/EventOrchestratorField";

/**
 * The always-visible core of the event dialog: identity (name / type /
 * duration) on the first row, assignment (orchestrator / shuffles / flags)
 * on the second. Everything optional lives in collapsible sections below.
 */
export function EventDetailsForm({
    event,
    localTitle,
    setLocalTitle,
    commit,
    leadInstructorIds,
}: {
    event: GanttEvent;
    localTitle: string;
    setLocalTitle: (v: string) => void;
    commit: (updates: Partial<GanttEvent>) => void;
    leadInstructorIds: Array<number>;
})
{
    const labelId = useId();
    return (
        <Stack spacing={ 2.5 }>
            <Box alignItems="flex-start" display="flex" gap={ 2 }>
                <TextField
                    label="שם"
                    onBlur={ () =>
                    {
                        if (localTitle !== event.title) commit({ title: localTitle });
                    } }
                    onChange={ (e) => setLocalTitle(e.target.value) }
                    sx={ { flex: 2, minWidth: "12rem" } }
                    value={ localTitle }
                />

                <FormControl sx={ { flex: 1, minWidth: "9rem" } }>
                    <InputLabel id={ labelId }>סוג</InputLabel>
                    <Select label="סוג"
                        labelId={ labelId }
                        onChange={ (e) =>
                        {
                            const type = e.target.value as ModuleEventType;
                            commit({
                                type,
                                splitAcrossBreaks: defaultModuleEventSplitAcrossBreaks(type),
                            });
                        } }
                        value={ event.type }
                    >
                        { Object.values(ModuleEventType).map((t) => (
                            <MenuItem key={ t } value={ t }>
                                { t }
                            </MenuItem>
                        )) }
                    </Select>
                </FormControl>

                <NumberSpinner
                    label="זמן מינימלי"
                    onValueChange={ (v) =>
                    {
                        if (v) commit({ minimumDuration: v });
                    } }
                    value={ event.minimumDuration }
                />
            </Box>

            <Box alignItems="flex-start" display="flex" gap={ 2 }>
                <EventOrchestratorField
                    commit={ commit }
                    event={ event }
                    leadInstructorIds={ leadInstructorIds }
                    sx={ { flex: 1, minWidth: "10rem" } }
                />

                <Stack direction="row" spacing={ 1 } sx={ { flexShrink: 0, pt: 0.25 } }>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={ event.isCritical }
                                onChange={ (e) =>
                                    commit({ isCritical: e.target.checked })
                                }
                                size="small"
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
                                size="small"
                            />
                        }
                        label='חלון פ"א'
                    />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={ event.splitAcrossBreaks }
                                onChange={ (e) =>
                                    commit({ splitAcrossBreaks: e.target.checked })
                                }
                                size="small"
                            />
                        }
                        label="פיצול סביב הפסקות"
                    />
                </Stack>
            </Box>
        </Stack>
    );
}
