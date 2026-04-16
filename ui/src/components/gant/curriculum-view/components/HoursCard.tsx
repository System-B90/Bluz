import { Box, Card, CircularProgress, Stack, Typography, useTheme } from '@mui/material';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';
import { useMemo } from 'react';

import { CurriculumDocument } from '@/api-client/gant/curriculum';
import { useCurriculumState } from '@/components/gant/state/provider';
import
    {
        calculateAllocatedTimeForCurriculum,
        calculateMinimumRequiredTimeForCurriculum
    } from '@/components/gant/utils';

export function HoursCard({ curriculum }: { curriculum: CurriculumDocument | undefined; })
{
    const theme = useTheme();
    const state = useCurriculumState();

    const totalWorkingHours = useMemo(() =>
    {
        return (curriculum?.weeks ?? []).reduce(
            (total, currentWeek) =>
                total + currentWeek.days.reduce((weekTotal, currentDay) => weekTotal + currentDay.totalWorkingHours, 0),
            0
        );
    }, [ curriculum?.weeks ]);

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
            <Typography variant="subtitle1" gutterBottom>שעות</Typography>
            <Box display="flex" flexDirection="row" alignItems="center" gap={ 3 }>
                <Gauge
                    width={ 80 }
                    height={ 80 }
                    value={ usedWorkingHours }
                    valueMin={ 0 }
                    valueMax={ totalWorkingHours }
                    text={ totalWorkingHours > 0 ? `${Math.round(100 * usedWorkingHours / totalWorkingHours)}%` : '-' }
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
                />
                <Stack spacing={ 0.5 }>
                    <Box display="flex" flexDirection="row" alignItems="baseline" gap={ 1 }>
                        <Typography variant="body2" color="text.secondary">ס&quot;ך:</Typography>
                        <Typography variant="body2" fontWeight="bold">{ totalWorkingHours.toFixed(2) }</Typography>
                    </Box>
                    <Box display="flex" flexDirection="row" alignItems="baseline" gap={ 1 }>
                        <Typography variant="body2" color="text.secondary">שנוצלו:</Typography>
                        <Typography variant="body2" fontWeight="bold">{ usedWorkingHours.toFixed(2) }</Typography>
                    </Box>
                    <Box display="flex" flexDirection="row" alignItems="baseline" gap={ 1 }>
                        <Typography variant="body2" color="text.secondary">מינימום דרוש:</Typography>
                        <Typography variant="body2" fontWeight="bold">{ minimumHoursRequired.toFixed(2) }</Typography>
                    </Box>
                </Stack>
            </Box>
        </Card>
    );
}
