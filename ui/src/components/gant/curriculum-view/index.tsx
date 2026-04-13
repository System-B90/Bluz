import { CurriculumId } from '@/api-shared/types/gant/curriculum';
import { useCurriculum } from '@/components/gant/state/hooks';
import SyllabusCard from '@/components/gant/syllabus-card';
import { Box, BoxProps, Card, Skeleton, Typography } from '@mui/material';
import { useMemo } from 'react';
import { CreateSyllabusButton } from './CreateSyllabusButton';
import { HoursCard } from './HoursCard';

export interface CurriculumViewProps extends BoxProps
{
    curriculumId: CurriculumId | null;
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
