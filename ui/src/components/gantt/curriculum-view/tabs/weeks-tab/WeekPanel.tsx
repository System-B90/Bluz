import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { Box, Chip, Divider, InputBase, Paper, Stack, Typography } from "@mui/material";
import { useSnackbar } from 'notistack';
import { useCallback, useMemo } from 'react';

import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { CurriculumDayId, CurriculumId, CurriculumWeekId } from "@/api-shared/types/gantt/curriculum";
import { ClosingSaturdayChip } from "@/components/gantt/curriculum-view/tabs/weeks-tab/ClosingSaturdayChip";
import { DayEntry } from '@/components/gantt/curriculum-view/tabs/weeks-tab/DayEntry';
import { useWeekActions } from "@/components/gantt/state/hooks/gant-funcs/UseWeekActions";
import { useCurriculumWeek } from "@/components/gantt/state/hooks/UseCurriculumWeek";
import { useCurriculumState } from "@/components/gantt/state/provider";

interface WeekPanelProps
{
    curriculumId: CurriculumId;
    weekId: CurriculumWeekId;
}

export function WorkTimeChip({ totalHours }: {
    totalHours: number;
})
{
    return (
        <Chip
            color="primary"
            icon={ <AccessTimeIcon sx={ { fontSize: '0.95rem !important' } } /> }
            label={ `${totalHours.toFixed(2)} שעות` }
            size="small"
            sx={ {
                fontWeight: 600,
                borderRadius: 1.5,
                '& .MuiChip-label': { px: 1.1 },
            } }
            variant="outlined"
        />
    );
}

export function WeekWorkTimeChip({
    weekId,
}: {
    weekId: CurriculumWeekId;
})
{
    const state = useCurriculumState();
    const week = useCurriculumWeek(weekId);
    
    const totalHours = useMemo(() => {
        if (!week?.days) return 0;
        return (week.days as CurriculumDayId[]).reduce((acc: number, dayId: CurriculumDayId) => {
            const day = state.days[dayId];
            return acc + (day?.totalWorkingHours ?? 0);
        }, 0);
    }, [ week?.days, state.days ]);

    return (
        <WorkTimeChip totalHours={ totalHours } />
    );
}

export function WeekPanel({ curriculumId, weekId }: WeekPanelProps)
{
    const { enqueueSnackbar } = useSnackbar();
    const week = useCurriculumWeek(weekId);
    const { updateWeek } = useWeekActions();

    const handleCommentBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) =>
    {
        const newValue = e.target.value;
        if (newValue !== week?.comment)
        {
            updateWeek(weekId, { comment: newValue })
                .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'שמירת הערה נכשלה!', error));
        }
    }, [ weekId, week?.comment, updateWeek, enqueueSnackbar ]);

    const renderedDays = useMemo(() =>
        (week?.days ?? []).map((dayId: CurriculumDayId) => (
            <DayEntry
                dayId={ dayId }
                key={ dayId }
            />
        )),
        [ week?.days ]);

    return (
        <Paper
            className="transition-shadow duration-200 hover:shadow-lg"
            elevation={ 3 }
            sx={ {
                minWidth: 300,
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                borderRadius: 2,
                bgcolor: 'background.paper'
            } }
        >
            <Box alignItems='flex-start' display='flex' flexDirection='row' gap={ 1 } justifyContent='space-between'>
                <Box flex={ 1 }>
                    <Typography className="text-slate-400 font-bold leading-none" variant="overline">
                        שבוע { week?.number }
                    </Typography>
                    <InputBase
                        className="text-sm font-bold text-slate-800"
                        defaultValue={ week?.comment ?? '' }
                        fullWidth
                        onBlur={ handleCommentBlur }
                        placeholder="הוסיפו הערת שבוע..."
                        sx={ { p: 0, mt: 0.5 } }
                    />
                </Box>

                <Box alignItems='flex-end' display='flex' flexDirection='column' gap={ 1 } sx={ { minWidth: 'fit-content' } }>
                    <WeekWorkTimeChip
                        weekId={ weekId }
                    />
                    <ClosingSaturdayChip
                        weekendDuty={ week?.weekendDuty ?? false }
                        weekId={ weekId }
                    />
                </Box>
            </Box>

            <Divider />

            <Stack spacing={ 1 }>
                { renderedDays }
            </Stack>
        </Paper>
    );
}
