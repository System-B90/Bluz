/**
 * Name: WeeksTab.tsx
 * Purpose: Container for horizontal scrolling week panels in Bluz.
 * Created: 2026-04-14
 * Author: Michael K. Steinberg
 */

import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import { WeekPanel } from "@/components/gant/curriculum-view/tabs/weeks-tab/WeekPanel";
import { useCurriculum } from "@/components/gant/state/hooks";
import { Box } from "@mui/material";
import { useMemo } from 'react';

export default function WeeksTab({ curriculumId }: { curriculumId: CurriculumId; })
{
    const curriculum = useCurriculum(curriculumId ?? '');

    const renderedPanels = useMemo(() =>
        (curriculum?.weeks || []).map((week, index) => (
            <WeekPanel
                key={ week.number }
                curriculumId={ curriculumId }
                weekIndex={ index }
            />
        )),
        [ curriculum?.weeks, curriculumId ]);

    return (
        <Box
            sx={ {
                display: 'flex',
                gap: 3,
                overflowX: 'auto',
                p: 2,
                minHeight: '500px',
                alignItems: 'flex-start'
            } }
        >
            { renderedPanels }
        </Box>
    );
}
