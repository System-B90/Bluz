import { Box, BoxProps, Stack, Typography } from '@mui/material';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';

import { SyllabusId } from '@/api-shared/types/gantt/curriculum';
import { useSyllabus } from '@/components/gantt/state/hooks/UseSyllabus';
import { useCurriculumState } from '@/components/gantt/state/provider';
import
    {
        calculateAllocatedTimeForSyllabus,
        calculateMinimumRequiredTimeForSyllabus
    } from '@/components/gantt/utils';

export interface HoursBoxProps extends BoxProps
{
    syllabusId: SyllabusId;
}

export function HoursBox({ syllabusId, ...props }: HoursBoxProps)
{
    const state = useCurriculumState();
    const syllabus = useSyllabus(syllabusId);

    const minimumRequiredHours = syllabus ? calculateMinimumRequiredTimeForSyllabus(syllabus, state) : 0;
    const wantedHours = 0;
    const allocatedHours = syllabus ? calculateAllocatedTimeForSyllabus(syllabus, state) : 0;

    const progressPercentage = minimumRequiredHours > 0
        ? Math.min((allocatedHours / minimumRequiredHours) * 100, 100)
        : 0;

    return (
        <Box { ...props }>
            <Box alignItems="center" display="flex" flexDirection="row" gap={ 1 }>
                <Gauge
                    height={ 60 }
                    sx={ {
                        [ `& .${gaugeClasses.valueText}` ]: {
                            fontSize: '0.75rem',
                            transform: 'translate(0px, -1px)',
                        },
                    } }
                    text={ `${Math.round(progressPercentage)}%` }
                    value={ progressPercentage }
                    width={ 60 }
                />
                <Stack spacing={ 0 }>
                    <Box alignItems="baseline" display="flex" flexDirection="row" gap={ 1 }>
                        <Typography color="text.secondary" fontSize="0.8rem" variant="body2">הוקצו:</Typography>
                        <Typography fontSize="0.8rem" fontWeight="bold" variant="body2">{ allocatedHours }</Typography>
                    </Box>
                    <Box alignItems="baseline" display="flex" flexDirection="row" gap={ 1 }>
                        <Typography color="text.secondary" fontSize="0.8rem" variant="body2">מינימום:</Typography>
                        <Typography fontSize="0.8rem" fontWeight="bold" variant="body2">{ minimumRequiredHours }</Typography>
                    </Box>
                    <Box alignItems="baseline" display="flex" flexDirection="row" gap={ 1 }>
                        <Typography color="text.secondary" fontSize="0.8rem" variant="body2">אידיאל:</Typography>
                        <Typography fontSize="0.8rem" fontWeight="bold" variant="body2">{ wantedHours }</Typography>
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
}
