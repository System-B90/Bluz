import { CurriculumDocument } from '@/api-client/gant/curriculum';
import { useCurriculumState } from '@/components/gant/state/provider';
import { calculateAllocatedTimeForCurriculum } from '@/components/gant/utils';
import { Box, Card, CircularProgress, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';

export function HoursCard({ curriculum }: { curriculum: CurriculumDocument | undefined; })
{
    const state = useCurriculumState();

    const totalWorkingHours = useMemo(() =>
    {
        return (curriculum?.weeks ?? []).reduce(
            (total, currentWeek) =>
                total + currentWeek.days.reduce((weekTotal, currentDay) => weekTotal + currentDay.totalWorkingHours, 0),
            0
        );
    }, [ curriculum?.weeks ]);

    const minimumTimeRequired = useMemo(() =>
    {
        if (!curriculum?.syllabuses || !state) return 0;

        return curriculum.syllabuses.reduce((sylTotal, syllabusId) =>
        {
            const syllabus = state.syllabuses[ syllabusId ];
            if (!syllabus) return sylTotal;

            return sylTotal + (syllabus.modules ?? []).reduce((modTotal, moduleId) =>
            {
                const moduleDoc = state.modules[ moduleId ];
                if (!moduleDoc) return modTotal;

                return modTotal + (moduleDoc.events ?? []).reduce((evtTotal, eventId) =>
                {
                    const event = state.events[ eventId ];
                    if (!event) return evtTotal;

                    return evtTotal + (event.minimumDuration ?? 0);
                }, 0);
            }, 0);
        }, 0);
    }, [ curriculum, state ]);

    const usedWorkingHours = useMemo(() => curriculum ? calculateAllocatedTimeForCurriculum(curriculum, state) : 0, [ curriculum, state ]);

    const progressPercentage = totalWorkingHours > 0
        ? Math.min((usedWorkingHours / totalWorkingHours) * 100, 100)
        : 0;

    if (!curriculum)
    {
        return (
            <Card sx={ { padding: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 150 } }>
                <CircularProgress />
            </Card>
        );
    }

    return (
        <Card sx={ { padding: 2 } }>
            <Typography variant="subtitle1" gutterBottom>שעות</Typography>
            <Box display="flex" flexDirection="row" alignItems="center" gap={ 3 }>
                <Box position="relative" display="inline-flex">
                    <CircularProgress
                        variant="determinate"
                        value={ 100 }
                        sx={ { color: 'grey.200' } }
                        size={ 60 }
                    />
                    <CircularProgress
                        variant="determinate"
                        value={ progressPercentage }
                        size={ 60 }
                        sx={ { position: 'absolute', left: 0 } }
                    />
                    <Box
                        sx={ {
                            top: 0,
                            left: 0,
                            bottom: 0,
                            right: 0,
                            position: 'absolute',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        } }
                    >
                        <Typography variant="caption" component="div" color="text.secondary">
                            { `${Math.round(progressPercentage)}%` }
                        </Typography>
                    </Box>
                </Box>
                <Stack spacing={ 0.5 }>
                    <Box display="flex" flexDirection="row" alignItems="baseline" gap={ 1 }>
                        <Typography variant="body2" color="text.secondary">ס&quot;ך:</Typography>
                        <Typography variant="body2" fontWeight="bold">{ totalWorkingHours }</Typography>
                    </Box>
                    <Box display="flex" flexDirection="row" alignItems="baseline" gap={ 1 }>
                        <Typography variant="body2" color="text.secondary">שנוצלו:</Typography>
                        <Typography variant="body2" fontWeight="bold">{ usedWorkingHours }</Typography>
                    </Box>
                    <Box display="flex" flexDirection="row" alignItems="baseline" gap={ 1 }>
                        <Typography variant="body2" color="text.secondary">מינימום דרוש:</Typography>
                        <Typography variant="body2" fontWeight="bold">{ minimumTimeRequired }</Typography>
                    </Box>
                </Stack>
            </Box>
        </Card>
    );
}
