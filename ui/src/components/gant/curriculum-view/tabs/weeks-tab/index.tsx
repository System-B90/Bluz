/**
 * Name: WeeksTab.tsx
 * Purpose: Renders vertical panels for each week in the curriculum.
 * Created: 2026-04-14
 * Author: Michael K. Steinberg
 */

import { CurriculumDays, CurriculumId, CurriculumWeek } from "@/api-shared/types/gant/curriculum";
import { useCurriculum } from "@/components/gant/state/hooks";
import { Box, Divider, Paper, Stack, Typography } from "@mui/material";

interface WeekPanelProps
{
    week: CurriculumWeek;
}

const WeekPanel = ({ week }: WeekPanelProps) =>
{
    return (
        <Paper
            elevation={ 2 }
            sx={ {
                minWidth: 250,
                maxHeight: '80vh',
                overflowY: 'auto',
                p: 2,
                bgcolor: 'background.default'
            } }
        >
            <Typography variant="h6" gutterBottom>
                Week { week.number }
            </Typography>
            <Divider sx={ { mb: 2 } } />

            <Stack spacing={ 2 }>
                { week.days.map((day: CurriculumDays) => (
                    <Box key={ day.day } sx={ { p: 1, borderBottom: '1px solid', borderColor: 'divider' } }>
                        <Typography variant="subtitle2" color="primary">
                            { day.day }
                        </Typography>
                        <Typography variant="body2">
                            Hours: { day.totalWorkingHours }
                        </Typography>
                        { day.comment && (
                            <Typography variant="caption" color="text.secondary">
                                { day.comment }
                            </Typography>
                        ) }
                    </Box>
                )) }
            </Stack>

            { week.comment && (
                <Box sx={ { mt: 2, pt: 1, borderTop: '1px dashed grey' } }>
                    <Typography variant="caption" sx={ { fontStyle: 'italic' } }>
                        Note: { week.comment }
                    </Typography>
                </Box>
            ) }
        </Paper>
    );
};

export default function WeeksTab({ curriculumId }: { curriculumId: CurriculumId; })
{
    const curriculum = useCurriculum(curriculumId ?? '');
    const weeks: Array<CurriculumWeek> = curriculum?.weeks || [];

    return (
        <Box
            sx={ {
                display: 'flex',
                flexDirection: 'row',
                gap: 2,
                overflowX: 'auto',
                pb: 2,
                alignItems: 'flex-start'
            } }
        >
            { weeks.map((week) => (
                <WeekPanel key={ week.number } week={ week } />
            )) }
        </Box>
    );
}
