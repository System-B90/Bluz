/**
 * Name: WorkTimePanel.tsx
 * Purpose: Management interface for curriculum work weeks and daily hour allocations.
 * Created: 2026-04-14
 * Author: Michael K. Steinberg
 */

import AddIcon from '@mui/icons-material/Add';
import { Box, Card, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import { useCallback, useState } from 'react';

import { CurriculumWeek } from '@/api-shared/types/gant/curriculum';
import { OverviewTab } from '@/components/gant/curriculum-view/components/WorkTimePanel/OverviewTab';
import { WorkTimePanelProps } from '@/components/gant/curriculum-view/components/WorkTimePanel/types';
import { useWorkTimePanelLogic } from '@/components/gant/curriculum-view/components/WorkTimePanel/useWorkTimePanelLogic';
import { cloneWeeks } from '@/components/gant/curriculum-view/components/WorkTimePanel/utils';

export function WorkTimePanel({ curriculumId, curriculum }: WorkTimePanelProps)
{
    const [ localWeeks, setLocalWeeks ] = useState(() => cloneWeeks(curriculum?.weeks ?? []));

    const canEdit = Boolean(curriculumId);
    const curriculumWeeks = curriculum?.weeks ?? [];
    const logic = useWorkTimePanelLogic(curriculumId, curriculumWeeks, localWeeks, setLocalWeeks);

    const addWeek = useCallback(async () =>
    {
        const nextNumber = (localWeeks[ localWeeks.length - 1 ]?.number ?? 0) + 1;
        const updatedWeeks: Array<CurriculumWeek> = [
            ...cloneWeeks(localWeeks),
            { number: nextNumber, comment: '', days: logic.buildDefaultWeekDays(), closingSaturday: false }
        ];
        await logic.persistWeeks(updatedWeeks);
    }, [ localWeeks, logic ]);

    if (!curriculum)
    {
        return (
            <Card sx={ { padding: 2, minHeight: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
                <CircularProgress />
            </Card>
        );
    }

    return (
        <Card sx={ {
            padding: 2,
            width: '100%',
            maxWidth: '22rem',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            flexGrow: 1,
        } }>
            <Box alignItems="center" display="flex" justifyContent="space-between" mb={ 0.5 }>
                <Typography gutterBottom variant="subtitle1">שעות עבודה לשיבוץ</Typography>
                <Tooltip title="הוספת שבוע">
                    <span>
                        <IconButton
                            color="primary"
                            disabled={ !canEdit }
                            onClick={ () => void addWeek() }
                            size="small"
                        >
                            <AddIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>

            <OverviewTab curriculumId={ curriculumId ?? '' } weeks={ localWeeks } />
        </Card>
    );
}
