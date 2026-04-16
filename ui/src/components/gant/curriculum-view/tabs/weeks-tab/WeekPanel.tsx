/**
 * Name: WeekPanel.tsx
 * Purpose: Individual vertical panel for curriculum week data entry with editable comments.
 * Created: 2026-04-14
 * Author: Michael K. Steinberg
 */

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { Box, Chip, Divider, InputBase, Paper, Stack, Typography } from "@mui/material";
import { useCallback, useMemo } from 'react';

import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import { ClosingSaturdayChip } from "@/components/gant/curriculum-view/tabs/weeks-tab/ClosingSaturdayChip";
import { DayEntry } from '@/components/gant/curriculum-view/tabs/weeks-tab/DayEntry';
import { useWeekActions } from "@/components/gant/state/hooks/gant-funcs/UseWeekActions";
import { useCurriculumWeek } from "@/components/gant/state/hooks/UseCurriculum";

interface WeekPanelProps
{
    curriculumId: CurriculumId;
    weekIndex: number;
}

export function WorkTimeChip({ totalHours }: {
    totalHours: number;
})
{
    return (
        <Chip
            icon={ <AccessTimeIcon sx={ { fontSize: '0.95rem !important' } } /> }
            label={ `${totalHours.toFixed(2)} שעות` }
            size="small"
            color="primary"
            variant="outlined"
            sx={ {
                fontWeight: 600,
                borderRadius: 1.5,
                '& .MuiChip-label': { px: 1.1 },
            } }
        />
    );
}

export function WeekWorkTimeChip({
    curriculumId,
    weekIndex,
}: {
    curriculumId: CurriculumId;
    weekIndex: number;
})
{
    const week = useCurriculumWeek(curriculumId, weekIndex);

    const totalHours = useMemo(() =>
        (week?.days ?? []).reduce((acc, d) => acc + d.totalWorkingHours, 0),
        [ week?.days ]);

    return (
        <WorkTimeChip totalHours={ totalHours } />
    );
}

export function WeekPanel({ curriculumId, weekIndex }: WeekPanelProps)
{
    const week = useCurriculumWeek(curriculumId, weekIndex);
    const { updateWeek } = useWeekActions();

    const handleCommentBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) =>
    {
        const newValue = e.target.value;
        if (newValue !== week?.comment)
        {
            updateWeek(curriculumId, weekIndex, { comment: newValue });
        }
    }, [ curriculumId, weekIndex, week?.comment, updateWeek ]);

    const renderedDays = useMemo(() =>
        (week?.days ?? []).map((day, dayIndex) => (
            <DayEntry
                key={ dayIndex }
                curriculumId={ curriculumId }
                weekIndex={ weekIndex }
                dayIndex={ dayIndex }
            />
        )),
        [ curriculumId, weekIndex, week?.days ]);

    return (
        <Paper
            elevation={ 3 }
            className="transition-shadow duration-200 hover:shadow-lg"
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
            <Box display='flex' flexDirection='row' justifyContent='space-between' alignItems='flex-start' gap={ 1 }>
                <Box flex={ 1 }>
                    <Typography variant="overline" className="text-slate-400 font-bold leading-none">
                        שבוע { week?.number }
                    </Typography>
                    <InputBase
                        fullWidth
                        defaultValue={ week?.comment ?? '' }
                        onBlur={ handleCommentBlur }
                        placeholder="הוסיפו הערת שבוע..."
                        className="text-sm font-bold text-slate-800"
                        sx={ { p: 0, mt: 0.5 } }
                    />
                </Box>

                <Box display='flex' flexDirection='column' gap={ 1 } alignItems='flex-end' sx={ { minWidth: 'fit-content' } }>
                    <WeekWorkTimeChip
                        curriculumId={ curriculumId }
                        weekIndex={ weekIndex }
                    />
                    <ClosingSaturdayChip
                        curriculumId={ curriculumId }
                        weekIndex={ weekIndex }
                        closingSaturday={ week?.closingSaturday ?? false }
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
