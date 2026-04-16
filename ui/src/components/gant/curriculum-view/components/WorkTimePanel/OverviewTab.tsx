import { Box, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';

import { CurriculumId, CurriculumWeek } from '@/api-shared/types/gant/curriculum';
import { WeekWorkTimeChip } from '@/components/gant/curriculum-view/tabs/weeks-tab/WeekPanel';

function WeekOverview({ curriculumId, weekIndex, week }: { curriculumId: CurriculumId; weekIndex: number; week: CurriculumWeek; })
{
    return (
        <Box key={ week.number } sx={ { border: 1, borderColor: 'divider', borderRadius: 1, p: 1 } }>
            <Box display="flex" justifyContent="space-between" alignItems="baseline" mb={ 0.5 }>
                <Typography variant="subtitle2">{ `שבוע ${week.number}` }</Typography>
                <WeekWorkTimeChip curriculumId={ curriculumId } weekIndex={ weekIndex } />
            </Box>
            <Typography variant="body2" color="text.secondary">
                { week.comment?.trim() || 'ללא הערה' }
            </Typography>
        </Box>
    );
}

export function OverviewTab({ curriculumId, weeks }: { curriculumId: CurriculumId; weeks: CurriculumWeek[]; })
{
    const overviews = useMemo(() => weeks.map((week, weekIndex) => (
        <WeekOverview key={ week.number } curriculumId={ curriculumId } weekIndex={ weekIndex } week={ week } />
    )), [ weeks, curriculumId ]);

    return (
        <Box sx={ { overflowY: 'scroll', paddingInlineEnd: 1 } }>
            <Stack spacing={ 1 }>
                { overviews }
            </Stack>
        </Box>
    );
}
