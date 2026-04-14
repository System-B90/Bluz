import { CurriculumId } from '@/api-shared/types/gant/curriculum';
import { CurriculumAboutCard } from '@/components/gant/curriculum-view/components/curriculum-about-card';
import CurriculumViewTabs from '@/components/gant/curriculum-view/tabs';
import { useCurriculum } from '@/components/gant/state/hooks';
import { Box, BoxProps } from '@mui/material';
import { HoursCard } from './components/HoursCard';
import { WorkTimePanel } from './components/WorkTimePanel';

export interface CurriculumViewProps extends BoxProps
{
    curriculumId: CurriculumId | null;
}

export default function CurriculumView({ curriculumId, ...props }: CurriculumViewProps)
{
    const curriculum = useCurriculum(curriculumId ?? '');

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

            <CurriculumViewTabs
                curriculumId={ curriculumId }
                flexGrow={ 1 }
                height={ '100%' }
                width={ '100%' }
                display={ 'flex' }
                flexDirection={ 'column' }
            />
        </Box>
    );
}
