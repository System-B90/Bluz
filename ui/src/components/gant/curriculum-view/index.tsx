import { Box, BoxProps } from '@mui/material';
import { useState } from 'react';

import { CurriculumId } from '@/api-shared/types/gant/curriculum';
import { CurriculumViewSidebar } from '@/components/gant/curriculum-view/components/sidebars';
import { CurriculumViewTabs } from '@/components/gant/curriculum-view/tabs';

export interface CurriculumViewProps extends BoxProps
{
    curriculumId: CurriculumId | null;
}

export function CurriculumView({ curriculumId, ...props }: CurriculumViewProps)
{
    const [ selectedTabIndex, setSelectedTabIndex ] = useState<number>(0);

    return (
        <Box
            alignItems={ 'flex-start' }
            display={ 'flex' }
            flexDirection={ 'row' }
            flexWrap={ 'nowrap' }
            gap={ 4 }
            height={ '100%' }
            justifyContent={ 'flex-start' }
            justifyItems={ 'flex-start' }
            width={ '100%' }
            { ...props }
        >
            <CurriculumViewSidebar curriculumId={ curriculumId } selectedTabIndex={ selectedTabIndex } />

            <CurriculumViewTabs
                curriculumId={ curriculumId }
                display={ 'flex' }
                flexDirection={ 'column' }
                flexGrow={ 1 }
                height={ '100%' }
                selectedTabIndex={ selectedTabIndex }
                setSelectedTabIndex={ setSelectedTabIndex }
                width={ '100%' }
            />
        </Box>
    );
}
