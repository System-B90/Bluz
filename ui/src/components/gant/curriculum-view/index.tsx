import { Box, BoxProps } from '@mui/material';
import { useState } from 'react';

import { CurriculumId } from '@/api-shared/types/gant/curriculum';
import CurriculumViewSidebar from '@/components/gant/curriculum-view/components/sidebars';
import CurriculumViewTabs from '@/components/gant/curriculum-view/tabs';

export interface CurriculumViewProps extends BoxProps
{
    curriculumId: CurriculumId | null;
}

export default function CurriculumView({ curriculumId, ...props }: CurriculumViewProps)
{
    const [ selectedTabIndex, setSelectedTabIndex ] = useState<number>(0);

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
            <CurriculumViewSidebar selectedTabIndex={ selectedTabIndex } curriculumId={ curriculumId } />

            <CurriculumViewTabs
                curriculumId={ curriculumId }
                selectedTabIndex={ selectedTabIndex }
                setSelectedTabIndex={ setSelectedTabIndex }
                flexGrow={ 1 }
                height={ '100%' }
                width={ '100%' }
                display={ 'flex' }
                flexDirection={ 'column' }
            />
        </Box>
    );
}
