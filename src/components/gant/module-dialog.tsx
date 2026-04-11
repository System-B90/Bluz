import { Module, ModuleEvent, ModuleEventId, ModuleEventType, ModuleId, SyllabusId } from "@/api-shared/types/gant/curriculum";
import NumberSpinner from "@/components/base/number-spinner";
import { useEvent, useGantFuncs, useModule } from "@/components/gant/state/hooks";
import { useCurriculumProviderActions } from "@/components/gant/state/provider";
import { calendarMoment } from "@/components/schedule/calendar/calendar";
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import
{
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogProps,
    DialogTitle,
    Divider,
    FormControl,
    IconButton,
    MenuItem,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography
} from "@mui/material";
import { Dispatch, SetStateAction, useCallback, useMemo, useState } from "react";
interface ModuleDialogProps extends DialogProps
{
    setOpen: Dispatch<SetStateAction<boolean>>;
    onSave?: (updated: Module) => void;
    moduleId: ModuleId | null;
    syllabusId: SyllabusId | null;
}

function valueRenderer(value: string): string
{
    console.log('Rendering', value);

    return calendarMoment.duration(value, 'minutes').humanize();
}

function ModuleEventView({ moduleId, eventId }: { moduleId: ModuleId; eventId: ModuleEventId; })
{
    const moduleEvent = useEvent(eventId);
    const { removeEvent, updateEvent } = useGantFuncs();

    const handleDeleteClick = useCallback(() =>
    {
        removeEvent(moduleId, eventId);
    }, [ eventId, moduleId, removeEvent ]);

    const updateHandler = useCallback((updates: Partial<ModuleEvent>) =>
    {
        updateEvent(eventId, updates);
    }, [ eventId, updateEvent ]);

    return (
        <TableRow>
            <TableCell>
                <TextField disabled={ !moduleEvent } size="small" fullWidth={ true } value={ moduleEvent?.title ?? '' } onChange={ (e) => updateHandler({ title: e.target.value }) } />
            </TableCell>
            <TableCell>
                <FormControl size="small" fullWidth={ true } disabled={ !moduleEvent }>
                    <Select
                        value={ moduleEvent?.type ?? ModuleEventType.Other }
                        onChange={ (e) => updateHandler({ type: e.target.value }) }
                    >
                        { (Object.values(ModuleEventType) as Array<ModuleEventType>).map((eventType: ModuleEventType) => (
                            <MenuItem key={ eventType } value={ eventType }>
                                { eventType }
                            </MenuItem>
                        )) }
                    </Select>
                </FormControl>
            </TableCell>
            <TableCell>
                <FormControl size="small" fullWidth={ true } disabled={ !moduleEvent } sx={ { margin: 0, padding: 0 } }>
                    <NumberSpinner
                        size={ "small" }
                        step={ 5 }
                        largeStep={ 45 }
                        label={ undefined }
                        style={ { margin: 0, padding: 0 } }
                        value={ moduleEvent?.minimumDuration ?? 0 }
                        onValueChange={ (v) => v ? updateHandler({ minimumDuration: v }) : undefined }
                    />
                </FormControl>
            </TableCell>
            <TableCell>
                <IconButton size="small" onClick={ handleDeleteClick }>
                    <DeleteIcon fontSize="small" color="error" />
                </IconButton>
            </TableCell>
        </TableRow >
    );
}

function CreateModuleEventButton({ moduleId }: { moduleId: ModuleId; })
{
    const { createEvent } = useGantFuncs();
    const clickHandler = useCallback(() =>
    {
        createEvent('מופע חדש', moduleId);
    }, [ moduleId, createEvent ]);

    return (
        <IconButton size="small" onClick={ clickHandler }>
            <AddIcon fontSize="small" color='action' />
        </IconButton>
    );
}

function ModuleEventsView({ moduleId, eventIds }: { moduleId: ModuleId; eventIds: Array<ModuleEventId>; })
{
    const eventItems = useMemo(() => eventIds.map(
        (eventId) => (<ModuleEventView key={ eventId } moduleId={ moduleId } eventId={ eventId } />)
    ), [ eventIds ]);

    return (
        <Box display={ 'flex' } flexWrap={ 'wrap' } alignItems={ 'flex-end' } gap={ 2 } flexGrow={ 1 } maxHeight={ '100%' }>
            <Table size="small" stickyHeader={ true } sx={ { flexGrow: 1 } }>
                <TableHead>
                    <TableRow>
                        <TableCell><Typography variant="h6">שם</Typography></TableCell>
                        <TableCell><Typography variant="h6">סוג</Typography></TableCell>
                        <TableCell><Typography variant="h6">זמן מינימלי (דק')</Typography></TableCell>
                        <TableCell>
                            <CreateModuleEventButton moduleId={ moduleId } />
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    { eventItems }
                </TableBody>
            </Table>
        </Box>
    );
}

function HiveModulesView({ hiveModules }: { hiveModules: Array<number>; })
{
    // TODO: Implement.
    return (
        <Box>

        </Box>
    );
}

export default function ModuleDialog({
    open,
    setOpen,
    onSave,
    syllabusId,
    moduleId,
    ...props
}: ModuleDialogProps)
{
    const { closeModuleDialog } = useCurriculumProviderActions();
    const { removeModule, updateModule } = useGantFuncs();
    const module = useModule(moduleId ?? '');
    const [ isActionLoading, setIsActionLoading ] = useState<boolean>(false);

    const handleClose = useCallback(() =>
    {
        setOpen(false);
    }, []);

    const handleDelete = useCallback(() =>
    {
        if (syllabusId === null || moduleId === null) { return; }
        setIsActionLoading(true);
        removeModule(syllabusId, moduleId)
            .then(() =>
            {
                closeModuleDialog();
                setIsActionLoading(false);
                setOpen(false);
            });
    }, [ syllabusId, moduleId, removeModule, closeModuleDialog, setOpen, ]);

    const updateHandler = useCallback((updates: Partial<Module>) =>
    {
        if (syllabusId === null || moduleId === null) { return; }
        updateModule(moduleId, updates);
    }, [ moduleId, updateModule ]);

    if (syllabusId === null || moduleId === null) { return; }

    return (
        <Dialog open={ open } onClose={ handleClose } fullWidth maxWidth="xl" { ...props }>
            <DialogTitle>עריכת מערך</DialogTitle>

            <DialogContent>
                <Box mt={ 1 } display={ 'flex' } flexDirection={ 'row' } gap={ 2 } alignItems={ 'flex-start' }>
                    <Stack spacing={ 2 } width={ '30%' } display={ 'flex' } flexDirection={ 'column' } alignItems={ 'stretch' } justifyContent={ 'stretch' } alignContent={ 'stretch' }>
                        <TextField
                            label="כותרת"
                            fullWidth
                            value={ module?.title ?? "" }
                            onChange={ (e) => updateHandler({ title: e.target.value }) }
                        />

                        <TextField
                            sx={ {
                                flex: 1,
                                '& .MuiInputBase-root': {
                                    height: '100%',
                                    alignItems: 'stretch',
                                },
                                '& textarea': {
                                    height: '100% !important',
                                },
                            } }
                            label="תיאור"
                            fullWidth
                            multiline
                            minRows={ 3 }
                            value={ module?.description ?? "" }
                            onChange={ (e) => updateHandler({ description: e.target.value }) }
                        />
                    </Stack>
                    <Divider orientation="vertical" flexItem />
                    <Stack spacing={ 2 } mt={ 1 } flexGrow={ 1 }>
                        <ModuleEventsView moduleId={ moduleId } eventIds={ module?.events ?? [] } />
                        <HiveModulesView hiveModules={ module?.hiveIds ?? [] } />
                    </Stack>
                </Box>
            </DialogContent>

            <DialogActions>
                <Button onClick={ handleDelete } disabled={ isActionLoading } color={ 'error' }>
                    מחיקה
                </Button>


                <Button onClick={ handleClose } disabled={ isActionLoading } color='primary' variant='contained'>
                    סגירה
                </Button>
            </DialogActions>
        </Dialog>
    );
}
