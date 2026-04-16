import { Box, BoxProps, Stack, Typography } from '@mui/material';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';

import { SyllabusId } from '@/api-shared/types/gant/curriculum';
import { useSyllabus } from '@/components/gant/state/hooks';
import { useCurriculumState } from '@/components/gant/state/provider';
import
{
    calculateAllocatedTimeForSyllabus,
    calculateMinimumRequiredTimeForSyllabus
} from '@/components/gant/utils';

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
            <Box display="flex" flexDirection="row" alignItems="center" gap={ 1 }>
                <Gauge
                    width={ 60 }
                    height={ 60 }
                    value={ progressPercentage }
                    text={ `${Math.round(progressPercentage)}%` }
                    sx={ {
                        [ `& .${gaugeClasses.valueText}` ]: {
                            fontSize: '0.75rem',
                            transform: 'translate(0px, -1px)',
                        },
                    } }
                />
                <Stack spacing={ 0 }>
                    <Box display="flex" flexDirection="row" alignItems="baseline" gap={ 1 }>
                        <Typography variant="body2" fontSize="0.8rem" color="text.secondary">הוקצו:</Typography>
                        <Typography variant="body2" fontSize="0.8rem" fontWeight="bold">{ allocatedHours }</Typography>
                    </Box>
                    <Box display="flex" flexDirection="row" alignItems="baseline" gap={ 1 }>
                        <Typography variant="body2" fontSize="0.8rem" color="text.secondary">מינימום:</Typography>
                        <Typography variant="body2" fontSize="0.8rem" fontWeight="bold">{ minimumRequiredHours }</Typography>
                    </Box>
                    <Box display="flex" flexDirection="row" alignItems="baseline" gap={ 1 }>
                        <Typography variant="body2" fontSize="0.8rem" color="text.secondary">אידיאל:</Typography>
                        <Typography variant="body2" fontSize="0.8rem" fontWeight="bold">{ wantedHours }</Typography>
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
}
