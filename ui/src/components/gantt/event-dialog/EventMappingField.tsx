import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import { useSnackbar } from "notistack";
import { useCallback, useEffect, useState, useId } from "react";

import { ganttApi } from "@/api-client/gantt";
import {
    GanttCurriculumId,
    GanttCurriculumModuleDayMapping,
    GanttDayId,
    GanttEventId,
    GanttModuleId,
} from "@/api-shared/types/gantt/models";
import { getDayNameDisplay } from "@/api-shared/types/gantt/models/day";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { useCurriculumState } from "@/components/gantt/state/context";
import { notifyMappingsChanged } from "@/components/gantt/state/mappings/change-bus";

/**
 * Lets the user allocate this event to a week/day directly from the event
 * dialog, instead of exiting to the רצף זמן tab and dragging it there (#447).
 * Talks to the mapping API directly rather than through GanttMappingProvider,
 * since that provider is only mounted inside the gantt-view tab and the event
 * dialog can be open independently of it.
 */
export function EventMappingField({
    curriculumId,
    moduleId,
    eventId,
}: {
    curriculumId: GanttCurriculumId;
    moduleId: GanttModuleId;
    eventId: GanttEventId;
})
{
    const labelId = useId();
    const { enqueueSnackbar } = useSnackbar();
    const state = useCurriculumState();
    const curriculum = state.curriculums[curriculumId];
    const weekIds = curriculum?.weeks ?? [];

    const [ mapping, setMapping ] = useState<GanttCurriculumModuleDayMapping | null>(null);
    const [ weekId, setWeekId ] = useState<string>("");
    const [ loading, setLoading ] = useState(true);
    const [ saving, setSaving ] = useState(false);

    useEffect(() =>
    {
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset loading for the new curriculumId/moduleId/eventId key
        setLoading(true);
        ganttApi.mappings.apiGet(curriculumId)
            .then((mappings) =>
            {
                if (cancelled) return;
                const existing = mappings.find(
                    (m) => m.moduleId === moduleId && m.eventId === eventId,
                );
                setMapping(existing ?? null);
                setWeekId(existing ? state.days[existing.dayId]?.weekId ?? "" : "");
            })
            .catch((error) =>
            {
                if (cancelled) return;
                enqueueApiErrorSnackbar(enqueueSnackbar, "טעינת שיבוץ המופע נכשלה!", error);
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ curriculumId, moduleId, eventId ]);

    const dayId = mapping?.dayId ?? "";
    const days = weekId ? state.weeks[weekId]?.days ?? [] : [];

    const applyMapping = useCallback(
        async (targetDayId: GanttDayId) =>
        {
            setSaving(true);
            try
            {
                if (mapping)
                {
                    const updated = await ganttApi.mappings.apiUpdate(
                        curriculumId,
                        moduleId,
                        eventId,
                        { dayId: mapping.dayId },
                        { dayId: targetDayId },
                    );
                    setMapping(updated);
                } else
                {
                    const created = await ganttApi.mappings.apiCreate(curriculumId, {
                        moduleId,
                        eventId,
                        dayId: targetDayId,
                        sortOrder: Date.now(),
                    });
                    setMapping(created);
                }
                notifyMappingsChanged(curriculumId);
                enqueueSnackbar("המופע שובץ בהצלחה", { variant: "success" });
            } catch (error)
            {
                enqueueApiErrorSnackbar(enqueueSnackbar, "שיבוץ המופע נכשל!", error);
            } finally
            {
                setSaving(false);
            }
        },
        [ mapping, curriculumId, moduleId, eventId, enqueueSnackbar ],
    );

    const handleUnmap = useCallback(async () =>
    {
        if (!mapping) return;
        setSaving(true);
        try
        {
            await ganttApi.mappings.apiDelete(curriculumId, moduleId, eventId, mapping.dayId);
            setMapping(null);
            setWeekId("");
            notifyMappingsChanged(curriculumId);
            enqueueSnackbar("שיבוץ המופע הוסר", { variant: "success" });
        } catch (error)
        {
            enqueueApiErrorSnackbar(enqueueSnackbar, "הסרת השיבוץ נכשלה!", error);
        } finally
        {
            setSaving(false);
        }
    }, [ mapping, curriculumId, moduleId, eventId, enqueueSnackbar ]);

    return (
        <Stack direction="row" spacing={ 2 }>
            <FormControl disabled={ loading || saving } size="small" sx={ { flex: 1, minWidth: "8rem" } }>
                <InputLabel id={ `${labelId}-1` }>שבוע</InputLabel>
                <Select label="שבוע"
                    labelId={ `${labelId}-1` }
                    onChange={ (e) => setWeekId(e.target.value as string) }
                    value={ weekId }
                >
                    <MenuItem value="">
                        <em>לא משובץ</em>
                    </MenuItem>
                    { weekIds.map((wId) => (
                        <MenuItem key={ wId } value={ wId }>
                            שבוע { state.weeks[wId]?.number }
                        </MenuItem>
                    )) }
                </Select>
            </FormControl>

            <FormControl disabled={ loading || saving || !weekId } size="small" sx={ { flex: 1, minWidth: "8rem" } }>
                <InputLabel id={ `${labelId}-2` }>יום</InputLabel>
                <Select label="יום"
                    labelId={ `${labelId}-2` }
                    onChange={ (e) => applyMapping(e.target.value as GanttDayId) }
                    value={ days.includes(dayId) ? dayId : "" }
                >
                    { days
                        .filter((dId) => state.days[ dId ])
                        .map((dId) => (
                            <MenuItem key={ dId } value={ dId }>
                                { getDayNameDisplay(state.days[ dId ].dayIndex) }
                            </MenuItem>
                        )) }
                </Select>
            </FormControl>

            { mapping ? (
                <Button
                    color="error"
                    disabled={ saving }
                    onClick={ handleUnmap }
                    size="small"
                    sx={ { alignSelf: "center", whiteSpace: "nowrap" } }
                >
                    בטל שיבוץ
                </Button>
            ) : null }
        </Stack>
    );
}
