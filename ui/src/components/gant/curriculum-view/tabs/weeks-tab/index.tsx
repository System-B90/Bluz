/**
 * Name: WeeksTab.tsx
 * Purpose: Container for horizontal scrolling week panels in Bluz.
 * Created: 2026-04-14
 * Author: Michael K. Steinberg
 */

import { Box } from "@mui/material";
import { useMemo } from 'react';

import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import { WeekPanel } from "@/components/gant/curriculum-view/tabs/weeks-tab/WeekPanel";
import { useCurriculum } from '@/components/gant/state/hooks/UseCurriculum';

export default function WeeksTab({ curriculumId }: { curriculumId: CurriculumId; })
{
    const curriculum = useCurriculum(curriculumId ?? '');

    const renderedPanels = useMemo(() =>
        (curriculum?.weeks || []).map((week, index) => (
            <WeekPanel
                curriculumId={ curriculumId }
                key={ week.number }
                weekIndex={ index }
            />
        )),
        [ curriculum?.weeks, curriculumId ]);

    return (
        <Box display={ 'flex' } flexDirection={ 'column' } flexGrow={ 1 } gap={ 2 } height={ '100%' }>
            <Box display="flex" flexDirection="column" gap={ 1 } height={ '100%' } width={ '100%' }>
                <Box alignContent={ 'flex-start' } display={ 'flex' } flexDirection={ 'column' } flexWrap={ 'wrap' } gap={ 2 } height={ '100%' } sx={ { overflowX: 'scroll' } }>
                    { renderedPanels }
                </Box>
            </Box>
        </Box>
    );
}
