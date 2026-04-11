import { CurriculumDocument } from '@/api-client/gant/curriculum';
import { CurriculumId } from '@/api-shared/types/gant/curriculum';
import { useCurriculum, useGantFuncs } from '@/components/gant/state/hooks';
import { useCurriculumState } from '@/components/gant/state/provider';
import SyllabusCard from '@/components/gant/syllabus-card';
import { calculateAllocatedTimeForCurriculum } from '@/components/gant/utils';
import AddIcon from '@mui/icons-material/Add';
import { Box, BoxProps, Button, Card, CircularProgress, Skeleton, Stack, Typography } from '@mui/material';
import { useCallback, useMemo } from 'react';

export interface CurriculumViewProps extends BoxProps
{
    curriculumId: CurriculumId | null;
}

function CreateSyllabusButton({ curriculumId }: { curriculumId: CurriculumId; })
{
    const { createSyllabus } = useGantFuncs();

    const clickHandler = useCallback(() =>
    {
        createSyllabus('סילבוס חדש', curriculumId);
    }, [ curriculumId, createSyllabus ]);

    return (
        <Button
            variant="contained"
            startIcon={ <AddIcon /> }
            onClick={ clickHandler }
        >
            סילבוס חדש
        </Button>
    );
}

function HoursCard({ curriculum }: { curriculum: CurriculumDocument | undefined; }) 
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

export default function CurriculumView({ curriculumId, ...props }: CurriculumViewProps)
{
    const curriculum = useCurriculum(curriculumId ?? '');

    const syllabusCards = useMemo(() =>
    {
        return (curriculum?.syllabuses ?? []).map((syllabusId) => (
            <SyllabusCard key={ syllabusId } syllabusId={ syllabusId } />
        ));
    }, [ curriculum?.syllabuses ]);

    return (
        <Box
            gap={ 4 }
            display={ 'flex' }
            flexDirection={ 'row' }
            flexWrap={ 'nowrap' }
            width={ '100%' }
            height={ '100%' }
            alignItems={ 'flex-start' }
            justifyItems={ 'flex-start' }
            justifyContent={ 'flex-start' }
            { ...props }
        >
            <Box display={ 'flex' } flexGrow={ 0 } flexShrink={ 0 } flexDirection={ 'column' } flexWrap={ 'wrap' } gap={ 2 }>
                <Card sx={ { padding: 2, maxWidth: '14rem' } }>
                    <Typography variant="h6" color="primary">
                        { curriculum ? curriculum.title : <Skeleton variant='text' width="40%" /> }
                    </Typography>
                    <Typography variant="body1" color='secondary'>
                        { curriculum ? curriculum.description : <Skeleton variant='text' width="100%" /> }
                    </Typography>
                    <Box display={ 'flex' } flexDirection={ 'row' } color="textSecondary">
                        <Typography variant="body2" color="textSecondary">
                            עדכון אחרון:
                        </Typography>
                        <Box width={ '0.2rem' } />
                        { curriculum?.updatedAt ? <Typography color="textSecondary">{ curriculum.updatedAt.format('DD/MM/YYYY') }</Typography> : <Skeleton variant='text' width={ 80 } /> }
                    </Box>
                </Card>

                <HoursCard curriculum={ curriculum } />
            </Box>

            <Box gap={ 2 } flexGrow={ 1 } display={ 'flex' } flexDirection={ 'column' } height={ '100%' }>
                {/* Syllabuses Section */ }
                { curriculumId && (
                    <Box display="flex" flexDirection="column" gap={ 1 } width={ '100%' } height={ '100%' }>
                        <Box display="flex" justifyContent="flex-start" mb={ 1 }>
                            <CreateSyllabusButton curriculumId={ curriculumId } />
                        </Box>
                        <Box gap={ 2 } display={ 'flex' } flexDirection={ 'column' } flexWrap={ 'wrap' } alignContent={ 'flex-start' } height={ '100%' } sx={ { overflow: 'scroll' } }>
                            { syllabusCards }
                        </Box>
                    </Box>
                ) }
            </Box>
        </Box>
    );
}
