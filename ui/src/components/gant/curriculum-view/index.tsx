import { CurriculumId } from '@/api-shared/types/gant/curriculum';
import { CurriculumAboutCard } from '@/components/gant/curriculum-view/curriculum-about-card';
import { SyllabusesActionsBox } from '@/components/gant/curriculum-view/syllabuses-actions-box';
import { useCurriculum } from '@/components/gant/state/hooks';
import SyllabusCard from '@/components/gant/syllabus-card';
import { Box, BoxProps } from '@mui/material';
import { useMemo } from 'react';
import { HoursCard } from './HoursCard';
import { WorkTimePanel } from './WorkTimePanel';

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
            <SyllabusCard key={ syllabusId } syllabusId={ syllabusId } curriculumId={ curriculumId ?? '' } />
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
                <CurriculumAboutCard curriculum={ curriculum } curriculumId={ curriculumId } />

                <HoursCard curriculum={ curriculum } />

                <WorkTimePanel curriculumId={ curriculumId } curriculum={ curriculum } />
            </Box>

            <Box gap={ 2 } flexGrow={ 1 } display={ 'flex' } flexDirection={ 'column' } height={ '100%' }>
                { curriculumId && (
                    <Box display="flex" flexDirection="column" gap={ 1 } width={ '100%' } height={ '100%' }>
                        <SyllabusesActionsBox curriculumId={ curriculumId } mb={ 1 } />
                        <Box gap={ 2 } display={ 'flex' } flexDirection={ 'column' } flexWrap={ 'wrap' } alignContent={ 'flex-start' } height={ '100%' } sx={ { overflow: 'scroll' } }>
                            { syllabusCards }
                        </Box>
                    </Box>
                ) }
            </Box>
        </Box>
    );
}
