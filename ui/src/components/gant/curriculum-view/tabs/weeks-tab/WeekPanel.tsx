/**
 * Name: WeekPanel.tsx
 * Purpose: Individual vertical panel for curriculum week data entry.
 * Created: 2026-04-14
 * Author: Michael K. Steinberg
 */

import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import { ClosingSaturdayChip } from "@/components/gant/curriculum-view/tabs/weeks-tab/ClosingSaturdayChip";
import { useCurriculumWeek } from "@/components/gant/state/hooks/UseCurriculum";
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import { useMemo } from 'react';
import { DayEntry } from "./DayEntry";

interface WeekPanelProps
{
    curriculumId: CurriculumId;
    weekIndex: number;
}

export function WeekPanel({ curriculumId, weekIndex }: WeekPanelProps)
{
    const week = useCurriculumWeek(curriculumId, weekIndex);

    const totalHours = useMemo(() =>
        (week?.days ?? []).reduce((acc, d) => acc + d.totalWorkingHours, 0),
        [ week?.days ]);

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
            sx={ {
                minWidth: 280,
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                borderRadius: 2
            } }
        >
            <Box display='flex' flexDirection={ 'row' } justifyContent='space-between' alignItems='flex-start'>
                <Box>
                    <Typography variant="overline" color="text.secondary">שבוע { week?.number }</Typography>
                    { week?.comment && (
                        <Typography variant="body2" sx={ { fontWeight: 'bold', mb: 1 } }>
                            { week.comment }
                        </Typography>
                    ) }
                </Box>


                <Box display='flex' flexDirection='column' gap={ 1 } alignItems={ 'flex-end' }>
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
                    <ClosingSaturdayChip curriculumId={ curriculumId } weekIndex={ weekIndex } closingSaturday={ week?.closingSaturday ?? false } />
                </Box>
            </Box>

            <Divider />

            <Stack spacing={ 1 }>
                { renderedDays }
            </Stack>
        </Paper>
    );
}
