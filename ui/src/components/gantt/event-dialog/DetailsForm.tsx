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

import {
    defaultSplitAcrossBreaks,
    GanttEvent,
    ModuleEventType,
} from "@/api-shared/types/gantt/models";
import { NumberSpinner } from "@/components/base/NumberSpinner";
import { EventOrchestratorField } from "@/components/gantt/event-dialog/EventOrchestratorField";
import { ShuffleSelect } from "@/components/gantt/ShuffleSelect";

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
    shuffleOptions,
}: {
    event: GanttEvent;
    localTitle: string;
    setLocalTitle: (v: string) => void;
    commit: (updates: Partial<GanttEvent>) => void;
    shuffleOptions: Array<string>;
})
{
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
                    <InputLabel>סוג</InputLabel>
                    <Select
                        label="סוג"
                        onChange={ (e) =>
                        {
                            const type = e.target.value as ModuleEventType;
                            commit({
                                type,
                                splitAcrossBreaks: defaultSplitAcrossBreaks(type),
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

                <Box display="flex" flexDirection="column">
                    <NumberSpinner
                        largeStep={ 45 }
                        onValueChange={ (v) =>
                            v ? commit({ minimumDuration: v }) : undefined
                        }
                        step={ 5 }
                        value={ event.minimumDuration }
                    />
                    <Typography
                        color="text.secondary"
                        sx={ { marginInlineStart: 0.5, mt: 0.5 } }
                        variant="caption"
                    >
                        זמן מינימלי (דק&apos;)
                    </Typography>
                </Box>
            </Box>

            <Box alignItems="flex-start" display="flex" gap={ 2 }>
                <EventOrchestratorField
                    commit={ commit }
                    event={ event }
                    sx={ { flex: 1, minWidth: "10rem" } }
                />

                { shuffleOptions.length > 0 && (
                    <Box sx={ { flex: 1, minWidth: "10rem" } }>
                        <ShuffleSelect
                            onChange={ (shuffles) => commit({ shuffles }) }
                            options={ shuffleOptions }
                            value={ event.shuffles ?? [] }
                        />
                    </Box>
                ) }

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
                        label="פיצול הפסקות"
                    />
                </Stack>
            </Box>
        </Stack>
    );
}
