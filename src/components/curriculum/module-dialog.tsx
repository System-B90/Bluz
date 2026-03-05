import { makeModuleEvent, Module, ModuleEvent, ModuleEventId, ModuleEventType, ModuleId } from "@/api-shared/types/curriculum";
import { ModuleEventProvider, ModuleEventsProvider, useModuleEvent, useModuleEvents } from "@/components/curriculum/module-event-provider";
import { useModule, useModules } from "@/components/curriculum/module-provider";
import
{
    Dialog,
    DialogActions,
    DialogContent,
    DialogProps,
    DialogTitle,
    Button,
    TextField,
    Stack,
    Box,
    Divider,
    Typography,
    TableRow,
    TableCell,
    Table,
    TableHead,
    TableBody,
    IconButton,
    FormControl,
    Select,
    MenuItem
} from "@mui/material";
import { Dispatch, RefObject, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AddIcon from '@mui/icons-material/Add';
import { BaseDocument } from "@/api-client/curriculum/curriculum";
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import NumberSpinner from "@/components/base/number-spinner";
import { calendarMoment, localizer } from "@/components/schedule/calendar/calendar";
import { apiUpdateModuleEvent } from "@/api-client/curriculum/module-event";

interface ModuleDialogProps extends DialogProps
{
    setOpen: Dispatch<SetStateAction<boolean>>;
    onSave?: (updated: Module) => void;
}

function valueRenderer(value: string): string
{
    console.log('Rendering', value);

    return calendarMoment.duration(value, 'minutes').humanize();
}

function ModuleEventView({ eventId, deleteCallback, copyRef }: { eventId: ModuleEventId; copyRef: RefObject<Record<ModuleEventId, ModuleEvent>>; deleteCallback: (removedModuleEventId: ModuleEventId) => void; })
{
    const { delete: deleteModuleEvent } = useModuleEvents();
    const { data: moduleEvent, save } = useModuleEvent();

    const [ moduleEventTitle, setModuleEventTitle ] = useState('');
    const [ moduleEventType, setModuleEventType ] = useState(ModuleEventType.Other);
    const [ moduleEventMinTime, setModuleEventMinTime ] = useState(0);

    useEffect(() =>
    {
        setModuleEventTitle(moduleEvent ? moduleEvent.title : '');
        setModuleEventType(moduleEvent ? moduleEvent.type : ModuleEventType.Other);
        setModuleEventMinTime(moduleEvent ? moduleEvent.minimumDuration : 0);
    }, [ moduleEvent ]);

    useEffect(() =>
    {
        if (!eventId || moduleEvent === null || moduleEventTitle === undefined || moduleEventType === undefined || moduleEventMinTime === undefined) { return; }
        copyRef.current[ eventId ] = { ...moduleEvent, title: moduleEventTitle, type: moduleEventType, minimumDuration: moduleEventMinTime };
    }, [ eventId, copyRef, moduleEvent, moduleEventTitle, moduleEventType, moduleEventMinTime ]);

    const handleSaveClick = useCallback(() =>
    {
        if (!moduleEvent) { return; }
        save({ ...moduleEvent, title: moduleEventTitle, type: moduleEventType, minimumDuration: moduleEventMinTime });
    }, [ moduleEvent, moduleEventTitle, moduleEventType, moduleEventMinTime, save ]);

    const handleDeleteClick = useCallback(() =>
    {
        deleteModuleEvent(eventId)
            .then(() => deleteCallback(eventId));
    }, [ eventId, deleteModuleEvent, deleteCallback ]);

    return (
        <TableRow>
            <TableCell>
                <TextField disabled={ !moduleEvent } size="small" fullWidth={ true } value={ moduleEventTitle } onChange={ (e) => setModuleEventTitle(e.target.value) } />
            </TableCell>
            <TableCell>
                <FormControl size="small" fullWidth={ true } disabled={ !moduleEvent }>
                    <Select
                        value={ moduleEventType }
                        onChange={ (e) => setModuleEventType(e.target.value) }
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
                        value={ moduleEventMinTime }
                        onValueChange={ (v) => v ? setModuleEventMinTime(v) : undefined }
                    />
                </FormControl>
            </TableCell>
            <TableCell>
                <IconButton size="small" onClick={ handleSaveClick }>
                    <SaveIcon fontSize="small" />
                </IconButton>
            </TableCell>
            <TableCell>
                <IconButton size="small" onClick={ handleDeleteClick }>
                    <DeleteIcon fontSize="small" />
                </IconButton>
            </TableCell>
        </TableRow >
    );
}

function CreateModuleEventButton({ onClickCallback }: { onClickCallback?: (createdModuleEvent: ModuleEvent & BaseDocument) => void; })
{
    const { create } = useModuleEvents();
    const clickHandler = useCallback(() =>
    {
        create(makeModuleEvent())
            .then((newModuleEvent) => onClickCallback?.(newModuleEvent));
    }, [ create, onClickCallback ]);

    return (
        <IconButton size="small" onClick={ clickHandler }>
            <AddIcon fontSize="small" />
        </IconButton>
    );
}

function ModuleEventsView({ moduleId, eventIds, eventsRef }: { moduleId: ModuleId | undefined; eventIds: RefObject<Array<ModuleEventId>>; eventsRef: RefObject<Record<ModuleEventId, ModuleEvent>>; })
{
    const [ localEventIds, setLocalEventIds ] = useState(eventIds.current);
    const moduleEventCreatedCallback = useCallback((newModuleEvent: ModuleEvent & BaseDocument) =>
    {
        setLocalEventIds((prev) =>
        {
            const newValues = [ ...prev, newModuleEvent.id ];
            eventIds.current = newValues;
            return newValues;
        });
    }, []);
    const moduleEventRemovedCallback = useCallback((removeModuleEventId: ModuleEventId) =>
    {
        setLocalEventIds((prev) =>
        {
            const newValues = [ ...prev.filter((x) => x !== removeModuleEventId) ];
            eventIds.current = newValues;
            return newValues;
        });
    }, []);
    const eventItems = useMemo(() => localEventIds.map(
        (eventId) => (
            <ModuleEventProvider key={ eventId } itemId={ eventId }>
                <ModuleEventView eventId={ eventId } deleteCallback={ moduleEventRemovedCallback } copyRef={ eventsRef } />
            </ModuleEventProvider>
        )
    ), [ localEventIds, eventsRef ]);

    return (
        <Box display={ 'flex' } flexWrap={ 'wrap' } alignItems={ 'flex-end' } gap={ 2 } flexGrow={ 1 } maxHeight={ '100%' }>
            { moduleId && <ModuleEventsProvider params={ { moduleId } }>
                <Table size="small" stickyHeader={ true } sx={ { flexGrow: 1 } }>
                    <TableHead>
                        <TableRow>
                            <TableCell><Typography variant="h6">שם</Typography></TableCell>
                            <TableCell><Typography variant="h6">סוג</Typography></TableCell>
                            <TableCell><Typography variant="h6">זמן מינימלי (דק')</Typography></TableCell>
                            <TableCell></TableCell>
                            <TableCell>
                                <CreateModuleEventButton onClickCallback={ moduleEventCreatedCallback } />
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        { eventItems }
                    </TableBody>
                </Table>
            </ModuleEventsProvider> }
        </Box>
    );
}

function HiveModulesView({ hiveModules }: { hiveModules: Array<number>; })
{
    return (
        <Box>

        </Box>
    );
}

export default function ModuleDialog({
    open,
    setOpen,
    onSave,
    ...props
}: ModuleDialogProps)
{
    const { delete: deleteModule } = useModules();
    const { data: module, setData: setModule, save } = useModule();
    const eventIdsRef = useRef<Array<ModuleEventId>>(module ? module.events : []);
    const eventsRef = useRef<Record<ModuleEventId, ModuleEvent>>({});
    const [ isActionLoading, setIsActionLoading ] = useState<boolean>(false);

    // Reset local state when dialog opens or module changes
    useEffect(() =>
    {
        if (open)
        {
            if (module)
            {
                eventIdsRef.current = module.events;
            }
        }
    }, [ open, module ]);

    const handleClose = useCallback(() =>
    {
        setOpen(false);
    }, []);

    const handleSave = useCallback(() =>
    {
        setIsActionLoading(true);
        if (module)
        {
            setModule((p) => p ? ({ ...p, events: eventIdsRef.current }) : null);
            save({ ...module, events: eventIdsRef.current })
                .then((savedModule) =>
                {
                    if (savedModule)
                    {
                        savedModule?.events.map((eventModuleId) =>
                        {
                            const newVal = eventsRef.current[ eventModuleId ];
                            apiUpdateModuleEvent({ curriculumId: '_', syllabusId: '_', moduleId: savedModule.id }, newVal);

                        });
                        onSave?.(savedModule);
                        setIsActionLoading(false);
                    }
                });
        }
        setOpen(false);
    }, [ module, save, onSave, setModule ]);

    const handleDelete = useCallback(() =>
    {
        if (!module) { return; }
        setIsActionLoading(true);
        deleteModule(module?.id)
            .then(() =>
            {
                setModule(null);
                setIsActionLoading(false);
                setOpen(false);
            });
    }, [ module, deleteModule ]);

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
                            onChange={ (e) =>
                                setModule(prev =>
                                    prev ? { ...prev, title: e.target.value } : prev
                                )
                            }
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
                            onChange={ (e) =>
                                setModule(prev =>
                                    prev ? { ...prev, description: e.target.value } : prev
                                )
                            }
                        />
                    </Stack>
                    <Divider orientation="vertical" flexItem />
                    <Stack spacing={ 2 } mt={ 1 } flexGrow={ 1 }>
                        <ModuleEventsView moduleId={ module?.id } eventIds={ eventIdsRef } eventsRef={ eventsRef } />
                        <HiveModulesView hiveModules={ module?.hiveIds ?? [] } />
                    </Stack>
                </Box>
            </DialogContent>

            <DialogActions>
                <Button onClick={ handleDelete } disabled={ isActionLoading } color={ 'error' }>
                    מחיקה
                </Button>


                <Button onClick={ handleClose } disabled={ isActionLoading }>
                    ביטול
                </Button>

                <Button
                    variant="contained"
                    onClick={ handleSave }
                    disabled={ !module?.title?.trim() || isActionLoading }
                >
                    שמור
                </Button>
            </DialogActions>
        </Dialog>
    );
}
