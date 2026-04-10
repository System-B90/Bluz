import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { BaseDocument } from '@/api-client/gant/base';
import { apiUpdateModule } from '@/api-client/gant/module';
import { makeModule, makeModuleEvent, Module, ModuleEventType, Syllabus, SyllabusId } from "@/api-shared/types/gant/curriculum";
import { useModuleEvents } from '@/components/gant/providers/module-event-provider';
import { ModuleProvider, ModulesProvider, useModule, useModules } from "@/components/gant/providers/module-provider";
import { SyllabusProvider, useSyllabus } from "@/components/gant/providers/syllabus-provider";
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

function ModuleRow()
{
    const { data: module, openDialog } = useModule();
    const [ minimumRequiredTime, setMinimumRequiredTime ] = useState<number>();
    const [ allocatedTime, setAllocatedTime ] = useState<number>();

    useEffect(() =>
    {
        let isMounted = true;

        if (!module) return;

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

function CreateModuleButton()
{
    const { enqueueSnackbar } = useSnackbar();
    const { addModule: addModuleToSyllabus } = useSyllabus();
    const { create: createModule } = useModules();
    const { create: createModuleEvent } = useModuleEvents();
    const [ isCreating, setIsCreating ] = useState(false);

    const clickHandler = useCallback(async () =>
    {
        setIsCreating(true);
        try
        {
            // Optimize groupings of asynchronous operations
            const [ newModule, createdLecture, createdExercise ] = await Promise.all([
                createModule(makeModule()),
                createModuleEvent(makeModuleEvent({ title: 'הרצאת מבוא', type: ModuleEventType.Lecture, minimumDuration: 60 })),
                createModuleEvent(makeModuleEvent({ title: 'ע"ע', type: ModuleEventType.Exercise, minimumDuration: 45 }))
            ]);

            console.log('newModule', newModule);
            await Promise.all([
                addModuleToSyllabus(newModule),
                apiUpdateModule({
                    ...newModule,
                    events: [ ...newModule.events, createdLecture.id, createdExercise.id ]
                }).catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'הוספת מופעי ברירת מחדל נכשלה!', error))
            ]);
        } finally
        {
            setIsCreating(false);
        }
    }, [ enqueueSnackbar, createModule, createModuleEvent, addModuleToSyllabus ]);

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

function SyllabusSaveButton()
{
    const { commit: commitSyllabus } = useSyllabus();
    const [ isSaving, setIsSaving ] = useState(false);

    const clickHandler = useCallback(async () =>
    {
        setIsSaving(true);
        try
        {
            await commitSyllabus();
        } finally
        {
            setIsSaving(false);
        }
    }, [ commitSyllabus ]);

    return (
        <Button
            size="small"
            variant="contained"
            startIcon={ isSaving ? <CircularProgress size="1rem" color="inherit" /> : <SaveIcon /> }
            onClick={ clickHandler }
            disabled={ isSaving }
        >
            שמור
        </Button>
    );
}

function SyllabusName()
{
    const { data: syllabus, setData } = useSyllabus();
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
        setData((prev) => prev ? ({ ...prev, title: localTitle }) : null);
    }, [ localTitle, setData ]);

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

function ModulesTable()
{
    const { data: syllabus } = useSyllabus();

    const moduleRows = useMemo(() =>
    {
        return (syllabus?.modules ?? []).map((moduleId) => (
            <ModuleProvider itemId={ moduleId } key={ moduleId }>
                <ModuleRow />
            </ModuleProvider>
        ));
    }, [ syllabus?.modules ]);

    return (
        <Box sx={ { overflowY: 'auto', flexGrow: 1, border: 1, borderColor: 'divider', borderRadius: 1 } }>
            <Table size="small" stickyHeader>
                <TableHead>
                    <TableRow>
                        <TableCell sx={ { fontWeight: 'bold' } }>שם המערך</TableCell>
                        <TableCell sx={ { fontWeight: 'bold' } }>זמן רצוי</TableCell>
                        <TableCell sx={ { fontWeight: 'bold' } }>זמן מוקצב</TableCell>
                        <TableCell width="1rem" align="center">
                            <CreateModuleButton />
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

function SyllabusCardInner()
{
    const { isLoading, data: syllabus, setData: setSyllabus } = useSyllabus();

    if (isLoading || !syllabus)
    {
        return (
            <CardContent sx={ { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 } }>
                <Skeleton variant="text" width="60%" height={ 40 } />
                <Skeleton variant="rectangular" height={ 200 } sx={ { borderRadius: 1 } } />
                <Box sx={ { display: 'flex', justifyContent: 'flex-start', mt: 'auto' } }>
                    <Skeleton variant="rectangular" width={ 80 } height={ 32 } sx={ { borderRadius: 1 } } />
                </Box>
            </CardContent>
        );
    }

    return (
        <>
            <CardContent sx={ { display: 'flex', flexDirection: 'column', paddingY: 1, flex: 1, overflow: 'hidden' } }>
                <SyllabusName />
                <ModulesTable />
            </CardContent>
            <CardActions sx={ { px: 2, pb: 2 } }>
                <ButtonGroup>
                    <SyllabusSaveButton />
                </ButtonGroup>
            </CardActions>
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
            <SyllabusProvider itemId={ syllabusId }>
                <SyllabusCardInner />
            </SyllabusProvider>
        </Card>
    );
}
