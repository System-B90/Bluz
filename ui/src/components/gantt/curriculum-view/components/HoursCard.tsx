import { Box, Card, CircularProgress, Stack, Typography, useTheme } from '@mui/material';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';
import { useMemo } from 'react';

import { GanttCurriculumDocument } from '@/api-client/gantt/curriculum';
import { useCurriculumState } from '@/components/gantt/state/provider';
import
    {
        calculateAllocatedTimeForCurriculum,
        calculateMinimumRequiredTimeForCurriculum
    } from '@/components/gantt/utils';

export function HoursCard({ curriculum }: { curriculum: GanttCurriculumDocument | undefined; })
{
    const theme = useTheme();
    const state = useCurriculumState();

    const totalWorkingHours = useMemo(() =>
    {
        return (curriculum?.weeks ?? []).reduce((total: number, weekId) =>
        {
            const week = state.weeks[ weekId ];
            if (!week) return total;
            return total + (week.days ?? []).reduce((weekTotal: number, dayId) =>
            {
                const day = state.days[ dayId ];
                return weekTotal + ((day?.totalWorkingMinutes ?? 0) / 60);
            }, 0);
        }, 0);
    }, [ curriculum?.weeks, state.weeks, state.days ]);

    const minimumHoursRequired = useMemo(() => curriculum ? calculateMinimumRequiredTimeForCurriculum(curriculum, state) / 60 : 0, [ curriculum, state ]);
    const usedWorkingHours = useMemo(() => curriculum ? calculateAllocatedTimeForCurriculum(curriculum, state) / 60 : 0, [ curriculum, state ]);

    if (!curriculum)
    {
        return (
            <Card sx={ { padding: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 150 } }>
                <CircularProgress />
            </Card>
        );
    }

    return (
        <Card sx={ { padding: 2, flexShrink: 0, } }>
            <Typography gutterBottom variant="subtitle1">שעות</Typography>
            <Box alignItems="center" display="flex" flexDirection="row" gap={ 3 }>
                <Gauge
                    height={ 80 }
                    sx={ {
                        [ `& .${gaugeClasses.valueText}` ]: {
                            fontSize: '1rem',
                            fontWeight: 'medium',
                            transform: 'translate(0px, -1px)',
                        },
                        [ `& .${gaugeClasses.valueArc}` ]: {
                            fill: totalWorkingHours === 0 ? 'grey.200' : (totalWorkingHours >= usedWorkingHours ? theme.palette.primary.main : theme.palette.warning.main),
                        },
                        [ `& .${gaugeClasses.referenceArc}` ]: {
                            fill: 'grey.200',
                        },
                    } }
                    text={ totalWorkingHours > 0 ? `${Math.round(100 * usedWorkingHours / totalWorkingHours)}%` : '-' }
                    value={ usedWorkingHours }
                    valueMax={ totalWorkingHours }
                    valueMin={ 0 }
                    width={ 80 }
                />
                <Stack spacing={ 0.5 }>
                    <Box alignItems="baseline" display="flex" flexDirection="row" gap={ 1 }>
                        <Typography color="text.secondary" variant="body2">ס&quot;ך:</Typography>
                        <Typography fontWeight="bold" variant="body2">{ totalWorkingHours.toFixed(2) }</Typography>
                    </Box>
                    <Box alignItems="baseline" display="flex" flexDirection="row" gap={ 1 }>
                        <Typography color="text.secondary" variant="body2">שנוצלו:</Typography>
                        <Typography fontWeight="bold" variant="body2">{ usedWorkingHours.toFixed(2) }</Typography>
                    </Box>
                    <Box alignItems="baseline" display="flex" flexDirection="row" gap={ 1 }>
                        <Typography color="text.secondary" variant="body2">מינימום דרוש:</Typography>
                        <Typography fontWeight="bold" variant="body2">{ minimumHoursRequired.toFixed(2) }</Typography>
                    </Box>
                </Stack>
            </Box>
        </Card>
    );
}
