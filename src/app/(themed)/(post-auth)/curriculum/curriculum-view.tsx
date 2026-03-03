import { BaseDocument, CurriculumDocument } from "@/api-client/curriculum/curriculum";
import { Curriculum, CurriculumId, makeSyllabus, Syllabus, SyllabusId } from "@/api-shared/types/curriculum";
import { useCurriculum } from "@/components/curriculum/curriculum-provider";
import { SyllabusProvider, useSyllabus } from "@/components/curriculum/syllabus-provider";
import { Box, BoxProps, Button, Card, CardContent, Grid, Skeleton, Typography } from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import { useCallback, useEffect, useMemo, useState } from "react";
import { ModuleProvider } from "@/components/curriculum/module-provider";

export interface CurriculumViewProps extends BoxProps
{
    curriculumId: CurriculumId | null;
}

function SyllabusCard({ syllabusId }: { syllabusId: SyllabusId; })
{
    const { get: getSyllabus } = useSyllabus();
    const [ syllabus, setSyllabus ] = useState<Syllabus>();

    useEffect(() =>
    {
        getSyllabus(syllabusId).then(setSyllabus);
    }, [ syllabusId, getSyllabus ]);

    return (
        <Card >
            <CardContent>
                <Typography>{ syllabus ? syllabus.title : <Skeleton variant="text" width="60%" /> }</Typography>
                { syllabus && <ModuleProvider params={ { syllabusId } }>

                </ModuleProvider> }
            </CardContent>
        </Card>
    );
}

function CreateSyllabusButton({ onClickCallback }: { onClickCallback?: (createdSyllabus: Syllabus & BaseDocument) => void; })
{
    const { create } = useSyllabus();
    const clickHandler = useCallback(() =>
    {
        create(makeSyllabus())
            .then((newSyllabus) => onClickCallback?.(newSyllabus));
    }, [ create, onClickCallback ]);

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

export default function CurriculumView({ curriculumId, ...props }: CurriculumViewProps)
{
    const { get: getCurriculum } = useCurriculum();
    const [ curriculum, setCurriculumData ] = useState<CurriculumDocument>();

    const fetchCurriculum = useCallback(async () =>
    {
        if (curriculumId !== null)
        {
            await getCurriculum(curriculumId).then(setCurriculumData);
        }
    }, [ curriculumId, getCurriculum ]);

    useEffect(() =>
    {
        fetchCurriculum();
    }, [ fetchCurriculum ]);

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

                <Card sx={ { padding: 2 } }>
                    <Typography variant="subtitle1" gutterBottom>שעות</Typography>
                    <Grid container spacing={ 2 }>
                        <Grid>
                            <Typography variant="body2">
                                ס"ך: { curriculum ? curriculum.totalWorkingHours : <Skeleton variant='text' width={ 30 } /> }
                            </Typography>
                        </Grid>
                        <Grid>
                            <Typography variant="body2">
                                {/* Assuming there's a field for used hours, fallback to 0 or skeleton */ }
                                שנוצלו: { curriculum ? (curriculum.usedWorkingHours ?? 0) : <Skeleton variant='text' width={ 30 } /> }
                            </Typography>
                        </Grid>
                    </Grid>
                </Card>
            </Box>

            <Box gap={ 2 } flexGrow={ 1 } display={ 'flex' } flexDirection={ 'column' } height={ '100%' }>
                {/* Syllabuses Section */ }
                { curriculumId && (
                    <SyllabusProvider params={ curriculumId }>
                        <Box display="flex" flexDirection="column" gap={ 1 } width={ '100%' } height={ '100%' }>
                            <Box display="flex" justifyContent="flex-start" mb={ 1 }>
                                <CreateSyllabusButton onClickCallback={ fetchCurriculum } />
                            </Box>
                            <Box gap={ 2 } display={ 'flex' } flexDirection={ 'column' } flexWrap={ 'wrap' } height={ '100%' } sx={ { overflow: 'scroll' } }>
                                { syllabusCards }
                            </Box>
                        </Box>
                    </SyllabusProvider>
                ) }
            </Box>
        </Box>
    );
}
