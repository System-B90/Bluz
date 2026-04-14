import { CurriculumWeek } from '@/api-shared/types/gant/curriculum';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { Box, Chip, Stack, Typography } from '@mui/material';

export function OverviewTab({ weeks }: { weeks: CurriculumWeek[]; })
{
    return (
        <Stack spacing={ 1 }>
            { weeks.map((week) => (
                <Box key={ week.number } sx={ { border: 1, borderColor: 'divider', borderRadius: 1, p: 1 } }>
                    <Box display="flex" justifyContent="space-between" alignItems="baseline" mb={ 0.5 }>
                        <Typography variant="subtitle2">{ `שבוע ${week.number}` }</Typography>
                        <Chip
                            icon={ <AccessTimeIcon sx={ { fontSize: '0.95rem !important' } } /> }
                            label={ `${week.days.reduce((sum, day) => sum + day.totalWorkingHours, 0)} שעות` }
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={ {
                                fontWeight: 600,
                                borderRadius: 1.5,
                                '& .MuiChip-label': { px: 1.1 },
                            } }
                        />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                        { week.comment?.trim() || 'ללא הערה' }
                    </Typography>
                </Box>
            )) }
        </Stack>
    );
}
