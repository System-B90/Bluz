import { Box, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';

import { CurriculumId, CurriculumWeekId } from '@/api-shared/types/gantt/curriculum';
import { WeekWorkTimeChip } from '@/components/gantt/curriculum-view/tabs/weeks-tab/WeekPanel';
import { useCurriculumWeek } from '@/components/gantt/state/hooks/UseCurriculumWeek';

function WeekOverview({ weekId }: { weekId: CurriculumWeekId; })
{
    const week = useCurriculumWeek(weekId);
    
    if (!week) return null;
    
    return (
        <Box key={ week.number } sx={ { border: 1, borderColor: 'divider', borderRadius: 1, p: 1 } }>
            <Box alignItems="baseline" display="flex" justifyContent="space-between" mb={ 0.5 }>
                <Typography variant="subtitle2">{ `שבוע ${week.number}` }</Typography>
                <WeekWorkTimeChip weekId={ weekId } />
            </Box>
            <Typography color="text.secondary" variant="body2">
                { week.comment?.trim() || 'ללא הערה' }
            </Typography>
        </Box>
    );
}

export function OverviewTab({ curriculumId, weeks }: { curriculumId: CurriculumId; weeks: CurriculumWeekId[]; })
{
    const overviews = useMemo(() => weeks.map((weekId) => (
        <WeekOverview key={ weekId } weekId={ weekId } />
    )), [ weeks ]);

    return (
        <Box sx={ { overflowY: 'scroll', paddingInlineEnd: 1 } }>
            <Stack spacing={ 1 }>
                { overviews }
            </Stack>
        </Box>
    );
}
