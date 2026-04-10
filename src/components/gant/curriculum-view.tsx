import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { BaseDocument } from "@/api-client/gant/base";
import { CurriculumDocument } from "@/api-client/gant/curriculum";
import { CurriculumId, Syllabus, makeSyllabus } from "@/api-shared/types/gant/curriculum";
import { useCurriculum, useCurriculums } from "@/components/gant/providers/curriculum-provider";
import { useSyllabuses } from "@/components/gant/providers/syllabus-provider";
import SyllabusCard from "@/components/gant/syllabus-card";
import { calculateMinimumRequiredTimeForCurriculum } from "@/components/gant/utils";
import AddIcon from '@mui/icons-material/Add';
import { Box, BoxProps, Button, Card, Skeleton, Stack, Typography } from "@mui/material";
import { enqueueSnackbar } from "notistack";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface CurriculumViewProps extends BoxProps
{
    curriculumId: CurriculumId | null;
}

function CreateSyllabusButton()
{
    const { create } = useSyllabuses();
    const { addSyllabus } = useCurriculum();

    const clickHandler = useCallback(() =>
    {
        create(makeSyllabus())
            .then((newSyllabus) => addSyllabus(newSyllabus));
    }, [ create, addSyllabus ]);

    return (
        <Button
            variant="contained"
            startIcon={ <AddIcon /> }
            onClick={ clickHandler }
        >
            סילבוס חדש
        </Button>
    );
}

function HoursCard({ curriculum }: { curriculum: CurriculumDocument | null; })
{
    const [ minimumTimeRequired, setMinimumTimeRequired ] = useState<number>();
    const totalWorkingHours = useMemo(() =>
        (curriculum?.weeks ?? []).reduce(
            (total, currentWeek) =>
                total + currentWeek.days.reduce(
                    (weekTotal, currentDay) =>
                        weekTotal + currentDay.totalWorkingHours,
                    0),
            0),
        [ curriculum?.weeks ]);

    useEffect(() =>
    {
        if (!curriculum) { return; }
        calculateMinimumRequiredTimeForCurriculum(curriculum, curriculum.syllabuses).then(setMinimumTimeRequired).catch((error) =>
        {
            enqueueApiErrorSnackbar(enqueueSnackbar, `חישוב הזמן המינימלי הדרוש נכשל.`, error);
        });
    }, [ curriculum, curriculum?.syllabuses ]);

    return (
        <Card sx={ { padding: 2 } }>
            <Typography variant="subtitle1" gutterBottom>שעות</Typography>
            <Stack>
                <Box display={ 'flex' } flexDirection={ 'row' } alignItems={ 'baseline' } gap={ 1 }>
                    <Typography variant="body2">
                        ס"ך:
                    </Typography>
                    <Typography variant="body2">
                        { curriculum ? totalWorkingHours : <Skeleton variant='text' width={ 30 } /> }
                    </Typography>
                </Box>
                <Box display={ 'flex' } flexDirection={ 'row' } alignItems={ 'baseline' } gap={ 1 }>
                    <Typography variant="body2">
                        שנוצלו:
                    </Typography>
                    <Typography variant="body2">
                        { curriculum ? (curriculum.usedWorkingHours ?? 0) : <Skeleton variant='text' width={ 30 } /> }
                    </Typography>
                </Box>
                <Box display={ 'flex' } flexDirection={ 'row' } alignItems={ 'baseline' } gap={ 1 }>
                    <Typography variant="body2">
                        מינימום דרוש:
                    </Typography>
                    <Typography variant="body2">
                        { (minimumTimeRequired !== undefined) ? minimumTimeRequired : <Skeleton variant='text' width={ 30 } /> }
                    </Typography>
                </Box>
            </Stack>
        </Card>
    );
}

export default function CurriculumView({ curriculumId, ...props }: CurriculumViewProps)
{
    const { isLoading, data: curriculum } = useCurriculum();

    const syllabusCards = useMemo(() =>
    {
        return (curriculum?.syllabuses ?? []).map((syllabusId) => (
            <SyllabusCard key={ syllabusId } syllabusId={ syllabusId } />
        ));
    }, [ curriculum?.syllabuses ]);

    return (
        <Box
            gap={ 4 }
            display={ 'flex' }
            flexDirection={ 'row' }
            flexWrap={ 'nowrap' }
            width={ '100%' }
            height={ '100%' }
            alignItems={ 'flex-start' }
            justifyItems={ 'flex-start' }
            justifyContent={ 'flex-start' }
            { ...props }
        >
            <Box display={ 'flex' } flexGrow={ 0 } flexShrink={ 0 } flexDirection={ 'column' } flexWrap={ 'wrap' } gap={ 2 }>
                <Card sx={ { padding: 2, maxWidth: '14rem' } }>
                    <Typography variant="h6" color="primary">
                        { curriculum ? curriculum.title : <Skeleton variant='text' width="40%" /> }
                    </Typography>
                    <Typography variant="body1" color='secondary'>
                        { curriculum ? curriculum.description : <Skeleton variant='text' width="100%" /> }
                    </Typography>
                    <Box display={ 'flex' } flexDirection={ 'row' } color="textSecondary">
                        <Typography variant="body2" color="textSecondary">
                            עדכון אחרון:
                        </Typography>
                        <Box width={ '0.2rem' } />
                        { curriculum?.updatedAt ? <Typography color="textSecondary">{ curriculum.updatedAt.format('DD/MM/YYYY') }</Typography> : <Skeleton variant='text' width={ 80 } /> }
                    </Box>
                </Card>

                <HoursCard curriculum={ curriculum } />
            </Box>

            <Box gap={ 2 } flexGrow={ 1 } display={ 'flex' } flexDirection={ 'column' } height={ '100%' }>
                {/* Syllabuses Section */ }
                { curriculumId && (
                    <Box display="flex" flexDirection="column" gap={ 1 } width={ '100%' } height={ '100%' }>
                        <Box display="flex" justifyContent="flex-start" mb={ 1 }>
                            <CreateSyllabusButton />
                        </Box>
                        <Box gap={ 2 } display={ 'flex' } flexDirection={ 'column' } flexWrap={ 'wrap' } alignContent={ 'flex-start' } height={ '100%' } sx={ { overflow: 'scroll' } }>
                            { syllabusCards }
                        </Box>
                    </Box>
                ) }
            </Box>
        </Box>
    );
}
