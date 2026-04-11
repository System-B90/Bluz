import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { apiUpdateModule } from '@/api-client/gant/module';
import { makeModule, makeModuleEvent, Module, ModuleEventType, ModuleId, Syllabus, SyllabusId } from "@/api-shared/types/gant/curriculum";
import { useCurriculumActions, useModule, useSyllabus } from '@/components/gant/state/hooks';
import { calculateAllocatedTimeForModule, calculateMinimumRequiredTimeForModule } from '@/components/gant/utils';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import
{
    Box,
    Button,
    ButtonGroup,
    Card,
    CardActions,
    CardContent,
    CardHeader,
    CircularProgress,
    IconButton,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { ChangeEventHandler, useCallback, useEffect, useMemo, useState } from 'react';

function ModuleRow({ moduleId }: { moduleId: ModuleId; })
{
    const module = useModule(moduleId);
    const [ minimumRequiredTime, setMinimumRequiredTime ] = useState<number>();
    const [ allocatedTime, setAllocatedTime ] = useState<number>();

    useEffect(() =>
    {
        let isMounted = true;

        Promise.all([
            calculateMinimumRequiredTimeForModule(module),
            calculateAllocatedTimeForModule(module)
        ]).then(([ minTime, allocTime ]) =>
        {
            if (isMounted)
            {
                setMinimumRequiredTime(minTime);
                setAllocatedTime(allocTime);
            }
        });

        return () =>
        {
            isMounted = false;
        };
    }, [ module ]);

    const editClickHandler = useCallback(() =>
    {
        if (!module) return;
        openDialog();
    }, [ module, openDialog ]);

    if (!module)
    {
        return (
            <TableRow>
                <TableCell><Skeleton variant="text" width="80%" /></TableCell>
                <TableCell><Skeleton variant="text" width="40px" /></TableCell>
                <TableCell><Skeleton variant="text" width="40px" /></TableCell>
                <TableCell>
                    <Skeleton variant="circular" width={ 24 } height={ 24 } />
                </TableCell>
            </TableRow>
        );
    }

    return (
        <TableRow hover>
            <TableCell>
                <Typography variant="body2">{ module.title }</Typography>
            </TableCell>
            <TableCell>
                { minimumRequiredTime !== undefined ? minimumRequiredTime : <CircularProgress size="1rem" /> }
            </TableCell>
            <TableCell>
                { allocatedTime !== undefined ? allocatedTime : <CircularProgress size="1rem" /> }
            </TableCell>
            <TableCell>
                <Tooltip title="ערוך מערך" placement="top">
                    <IconButton size="small" onClick={ editClickHandler } color="primary">
                        <EditIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </TableCell>
        </TableRow>
    );
}

function CreateModuleButton({ syllabusId }: { syllabusId: SyllabusId; })
{
    const { enqueueSnackbar } = useSnackbar();
    const { createModule, createEvent } = useCurriculumActions();
    const [ isCreating, setIsCreating ] = useState(false);

    const clickHandler = useCallback(async () =>
    {
        setIsCreating(true);
        try
        {
            const newModule = await createModule('מודול חדש', syllabusId, 'המודול החדש שלי');


            // Optimize groupings of asynchronous operations
            const [ createdLecture, createdExercise ] = await Promise.all([
                createEvent('הרצאת מבוא', newModule.id, ModuleEventType.Lecture, 60),
                createEvent('ע"ע', newModule.id, ModuleEventType.Exercise, 45)
            ]);

            console.log('newModule', newModule);
        } finally
        {
            setIsCreating(false);
        }
    }, [ enqueueSnackbar, createModule, createEvent ]);

    return (
        <Tooltip title="מערך חדש" placement="top">
            <span>
                <IconButton size="small" color="secondary" onClick={ clickHandler } disabled={ isCreating }>
                    { isCreating ? <CircularProgress size="1.25rem" color="inherit" /> : <AddIcon fontSize="small" /> }
                </IconButton>
            </span>
        </Tooltip>
    );
}

function SyllabusName({ syllabusId }: { syllabusId: SyllabusId; })
{
    const { updateSyllabus } = useCurriculumActions();
    const syllabus = useSyllabus(syllabusId);
    const [ localTitle, setLocalTitle ] = useState(syllabus?.title ?? '');

    useEffect(() =>
    {
        setLocalTitle(syllabus?.title ?? '');
    }, [ syllabus?.title ]);

    const onChange: ChangeEventHandler<HTMLInputElement> = useCallback((e) =>
    {
        setLocalTitle(e.target.value);
    }, []);

    const onBlur = useCallback(() =>
    {
        updateSyllabus(syllabusId, { title: localTitle });
    }, [ localTitle, updateSyllabus ]);

    return (
        <TextField
            label="שם הסילבוס"
            size="small"
            value={ localTitle }
            onChange={ onChange }
            onBlur={ onBlur }
            variant="standard"
            required
            type="text"
            fullWidth
            sx={ { mb: 2 } }
        />
    );
}

function ModulesTable({ syllabusId, syllabusModules }: { syllabusId: SyllabusId; syllabusModules: Syllabus[ 'modules' ]; })
{
    const moduleRows = useMemo(() =>
    {
        return syllabusModules.map((moduleId) => (
            <ModuleRow key={ moduleId } moduleId={ moduleId } />
        ));
    }, [ syllabusModules ]);

    return (
        <Box sx={ { overflowY: 'auto', flexGrow: 1, border: 1, borderColor: 'divider', borderRadius: 1 } }>
            <Table size="small" stickyHeader>
                <TableHead>
                    <TableRow>
                        <TableCell sx={ { fontWeight: 'bold' } }>שם המערך</TableCell>
                        <TableCell sx={ { fontWeight: 'bold' } }>זמן רצוי</TableCell>
                        <TableCell sx={ { fontWeight: 'bold' } }>זמן מוקצב</TableCell>
                        <TableCell width="1rem" align="center">
                            <CreateModuleButton syllabusId={ syllabusId } />
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    { moduleRows.length > 0 ? moduleRows : (
                        <TableRow>
                            <TableCell colSpan={ 4 } align="center">
                                <Typography variant="caption" color="textSecondary">
                                    לא נמצאו מערכים. לחץ על הוסף כדי להתחיל.
                                </Typography>
                            </TableCell>
                        </TableRow>
                    ) }
                </TableBody>
                <TableFooter />
            </Table>
        </Box>
    );
}

function SyllabusCardInner({ syllabusId }: { syllabusId: SyllabusId; })
{
    const syllabus = useSyllabus(syllabusId);
    console.log('syllabus', syllabus);
    return (
        <>
            <CardContent sx={ { display: 'flex', flexDirection: 'column', paddingY: 1, flex: 1, overflow: 'hidden' } }>
                <SyllabusName syllabusId={ syllabusId } />
                <ModulesTable syllabusModules={ syllabus.modules } syllabusId={ syllabusId } />
            </CardContent>
        </>
    );
}

export default function SyllabusCard({ syllabusId }: { syllabusId: SyllabusId; })
{
    return (
        <Card sx={ { display: 'flex', flexDirection: 'column', width: '30%', minWidth: 350, maxHeight: '90%', overflow: 'hidden' } }>
            <CardHeader
                title={ <Typography variant="subtitle2" color="textSecondary">סילבוס</Typography> }
                sx={ { pb: 0, pt: 1.5, px: 2 } }
            />
            <SyllabusCardInner syllabusId={ syllabusId } />
        </Card>
    );
}
