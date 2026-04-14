/**
 * Name: WeekPanel.tsx
 * Purpose: Individual vertical panel for curriculum week data entry.
 * Created: 2026-04-14
 * Author: Michael K. Steinberg
 */

import { CurriculumDays, CurriculumId, DayName } from "@/api-shared/types/gant/curriculum";
import { useWeekActions } from "@/components/gant/state/hooks/gant-funcs/UseWeekActions";
import { useCurriculumWeek } from "@/components/gant/state/hooks/UseCurriculum";
import { Box, Divider, Paper, Stack, Typography } from "@mui/material";
import { useCallback, useMemo } from 'react';
import { DayEntry } from "./DayEntry";

interface WeekPanelProps
{
    curriculumId: CurriculumId;
    weekIndex: number;
}

export function WeekPanel({ curriculumId, weekIndex }: WeekPanelProps)
{
    const week = useCurriculumWeek(curriculumId, weekIndex);
    const { updateWeek } = useWeekActions();

    const totalHours = useMemo(() =>
        (week?.days ?? []).reduce((acc, d) => acc + d.totalWorkingHours, 0),
        [ week?.days ]);

    const handleUpdateDay = useCallback((dayName: DayName, field: keyof CurriculumDays, value: string | number) =>
    {
        updateWeek(curriculumId, weekIndex, {
            days: { [ dayName ]: { [ field ]: value } }
        });
    }, [ curriculumId, weekIndex, updateWeek ]);

    const renderedDays = useMemo(() =>
        (week?.days ?? []).map((day) => (
            <DayEntry
                key={ day.day }
                day={ day }
                onUpdate={ handleUpdateDay }
            />
        )),
        [ week?.days, handleUpdateDay ]);

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
            <Box>
                <Typography variant="overline" color="text.secondary">Week { week?.number }</Typography>
                { week?.comment && (
                    <Typography variant="body2" sx={ { fontWeight: 'bold', mb: 1 } }>
                        { week.comment }
                    </Typography>
                ) }
            </Box>

            <Box sx={ { display: 'flex', justifyContent: 'center', my: 1, gap: 1, alignItems: 'baseline' } }>
                <Typography variant="body2" color="text.secondary">ס&quot;ך:</Typography>
                <Typography variant="body2" fontWeight="bold">{ totalHours }</Typography>
            </Box>

            <Divider />

            <Stack spacing={ 1 }>
                { renderedDays }
            </Stack>
        </Paper>
    );
}
