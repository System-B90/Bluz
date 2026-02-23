'use client';

import
{
    Box,
    Button,
    Checkbox,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    Typography,
} from '@mui/material';
import { FormEvent, Fragment, useCallback, useEffect, useState } from "react";

import { Event, EventId } from "@/components/schedule/types/event";
import { useOffline } from '@/components/base/offline-provider';
import { useCalendar } from '@/components/schedule/calendar/calendar-provider';
import { apiGetMultipleEvents } from '@/api-client/calendar';
import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { enqueueSnackbar } from 'notistack';
import { areEventsEqual, areValuesEqual } from '@/components/schedule/types/event-utils';
import assert from 'assert';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

interface PushOfflineUpdatesDialogProps
{
}

type CollisionStates = Record<EventId, {
    localModifiedEvent: Event | undefined;
    serverVersion: Event | undefined;
    capturedVersion: Event | undefined;
    conflicting: boolean;
}>;

function DeletedItemPlaceholder()
{
    return (
        <Typography color='error' fontStyle={ 'italic' }>המופע עצמו נמחק</Typography>
    );
}

function EventListEntry({ isItemSelected, handleEntryClick, eventId, localModifiedEvent, serverVersion, capturedVersion, conflicting }: { isItemSelected: boolean, handleEntryClick: (event: React.MouseEvent<HTMLTableRowElement>, entryId: EventId) => void, eventId: EventId, localModifiedEvent: Event | undefined; serverVersion: Event | undefined; capturedVersion: Event | undefined; conflicting: boolean; })
{
    console.log(eventId, localModifiedEvent, serverVersion, capturedVersion, conflicting);
    const [ expanded, setExpanded ] = useState<boolean>(false);
    const allKeys: Array<keyof Event> = [ ...new Set([ ...Object.keys(localModifiedEvent ?? {}), ...Object.keys(serverVersion ?? {}), ...Object.keys(capturedVersion ?? {}) ]) ] as Array<keyof Event>;

    const changeItems = allKeys.filter(
        (key) => (
            (localModifiedEvent !== undefined && serverVersion !== undefined && !areValuesEqual(localModifiedEvent?.[ key ], serverVersion?.[ key ])) ||
            (serverVersion !== undefined && capturedVersion !== undefined && !areValuesEqual(serverVersion?.[ key ], capturedVersion?.[ key ])) ||
            (localModifiedEvent !== undefined && capturedVersion !== undefined && !areValuesEqual(localModifiedEvent?.[ key ], capturedVersion?.[ key ]))
        )).map((key) => (
            <TableRow key={ `${eventId}-${key}` }>
                <TableCell><Typography>{ key }</Typography></TableCell>
                <TableCell>{ localModifiedEvent?.[ key ] ? <Typography>{ localModifiedEvent?.[ key ]?.toString() }</Typography> : <DeletedItemPlaceholder /> }</TableCell>
                <TableCell>{ capturedVersion?.[ key ] ? <Typography>{ capturedVersion?.[ key ]?.toString() }</Typography> : <DeletedItemPlaceholder /> }</TableCell>
                <TableCell>{ serverVersion?.[ key ] ? <Typography>{ serverVersion?.[ key ]?.toString() }</Typography> : <DeletedItemPlaceholder /> }</TableCell>
            </TableRow>
        ));

    return (
        <Fragment>
            <TableRow
                sx={ { '& > *': { borderBottom: 'unset' } } } hover
                selected={ isItemSelected }
                role='checkbox'
                aria-checked={ isItemSelected }
                onClick={ (e) => handleEntryClick(e, eventId) }>
                <TableCell>
                    <IconButton
                        aria-label="expand row"
                        size="small"
                        onClick={ (e) => { e.stopPropagation(); e.preventDefault(); setExpanded((v) => !v); } }
                    >
                        { expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon /> }
                    </IconButton>
                </TableCell>
                <TableCell component="th" scope="row"><Typography>{ eventId }</Typography></TableCell>
                <TableCell><Typography>{ localModifiedEvent?.name ?? serverVersion?.name ?? capturedVersion?.name }</Typography></TableCell>
                <TableCell><Typography color={ conflicting ? 'error' : 'inherit' }>{ conflicting ? 'קונפליקט!' : 'אין' }</Typography></TableCell>
                <TableCell padding="checkbox">
                    <Checkbox
                        color="primary"
                        checked={ isItemSelected }
                    />
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell style={ { paddingBottom: 0, paddingTop: 0 } } colSpan={ 4 }>
                    <Collapse in={ expanded } timeout="auto" unmountOnExit>
                        <Box sx={ { margin: 1 } }>
                            <Typography variant="h6" gutterBottom component="div">
                                שינויים
                            </Typography>
                            <Table size="small" aria-label="purchases">
                                <TableHead>
                                    <TableRow>
                                        <TableCell><Typography fontWeight={ 600 }>שם השדה</Typography></TableCell>
                                        <TableCell><Typography fontWeight={ 600 }>השינוי שלך</Typography></TableCell>
                                        <TableCell><Typography fontWeight={ 600 }>מה שראית לפני ששינית</Typography></TableCell>
                                        <TableCell><Typography fontWeight={ 600 }>מה שיש כרגע בשרת</Typography></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    { changeItems }
                                </TableBody>
                            </Table>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </Fragment>
    );
}

function EventCollisionsList({ collisionStates }: { collisionStates: CollisionStates; })
{
    const [ selected, setSelected ] = useState<Array<EventId>>([]);
    const numSelected = selected.length;
    const rowCount = Object.keys(collisionStates).length;

    const onSelectAllClick = useCallback(() =>
    {
        setSelected((oldSelected) =>
        {
            if (oldSelected.length === 0)
            {
                return Object.keys(collisionStates);
            }
            else
            {
                return [];
            }
        });
    }, [ collisionStates ]);

    const handleEntryClick = useCallback((_e: React.MouseEvent<HTMLTableRowElement>, eventId: EventId) =>
    {
        setSelected((oldSelected) =>
        {
            if (oldSelected.includes(eventId))
            {
                return oldSelected.filter((x) => x !== eventId);
            }
            else
            {
                return [ ...oldSelected, eventId ];
            }
        });
    }, []);

    useEffect(() =>
    {
        setSelected(Object.keys(collisionStates).filter((eventId) => !collisionStates[ eventId ].conflicting));
    }, [ collisionStates ]);

    console.log('collisionStates', collisionStates);
    const items = Object.keys(collisionStates).map((eventId) => (
        <EventListEntry isItemSelected={ selected.includes(eventId) } key={ eventId } eventId={ eventId } { ...collisionStates[ eventId ] } handleEntryClick={ handleEntryClick } />
    ));

    return (
        <TableContainer component={ Paper }>
            <Table aria-label="collapsible table">
                <TableHead>
                    <TableRow>
                        <TableCell />
                        <TableCell><Typography fontWeight={ 600 }>מזהה מופע</Typography></TableCell>
                        <TableCell><Typography fontWeight={ 600 }>שם</Typography></TableCell>
                        <TableCell>
                            <TableSortLabel
                            ><Typography fontWeight={ 600 }>קונפליקט?</Typography>
                            </TableSortLabel>
                        </TableCell>
                        <TableCell padding="checkbox">
                            <Checkbox
                                color="primary"
                                indeterminate={ numSelected > 0 && numSelected < rowCount }
                                checked={ rowCount > 0 && numSelected === rowCount }
                                onChange={ onSelectAllClick }
                                inputProps={ {
                                    'aria-label': 'select all',
                                } }
                            />
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    { items }
                </TableBody>
            </Table>
        </TableContainer>
    );
}

export default function PushOfflineUpdatesDialog({

}: PushOfflineUpdatesDialogProps)
{
    const { pushDialogOpen, getCapturedEvent } = useOffline();
    const { events: localEvents } = useCalendar();
    const [ collisionStates, setCollisionStates ] = useState<CollisionStates>({});
    console.log('localEvents', localEvents);

    const onClose = useCallback(() => { }, []);
    const submitHandler = useCallback((e: FormEvent<HTMLFormElement>) =>
    {
        e.preventDefault();
    }, []);

    const checkEventCollisionStates = useCallback(async (): Promise<CollisionStates> =>
    {
        const states: CollisionStates = {};

        // Get the saved copy of the events we changed locally from before they were changed
        const capturedEventsBeforeEdit = localEvents.map((event) => getCapturedEvent(event.id)).filter((ev) => !!ev);

        const serverEvents = await apiGetMultipleEvents(localEvents.map((ev) => ev.id))
            .catch((error) => { enqueueApiErrorSnackbar(enqueueSnackbar, `טעינת המצב העדכני בשרת נכשלה!`, error); return null; });
        if (serverEvents === null) { return {}; }

        console.log('capturedEventsBeforeEdit', capturedEventsBeforeEdit);
        console.log('serverEvents', serverEvents);

        capturedEventsBeforeEdit.forEach((capturedEventBeforeEdit) =>
        {
            // For each of the events we changed locally and have a capture, check if the server version changed between the capture and the new data
            const serverVersion = serverEvents[ capturedEventBeforeEdit.id ];
            assert(serverVersion === undefined || capturedEventBeforeEdit === undefined || serverVersion.id === capturedEventBeforeEdit.id); // Sanity

            states[ capturedEventBeforeEdit.id ] = {
                localModifiedEvent: localEvents.find((ev) => ev.id === capturedEventBeforeEdit.id),
                capturedVersion: capturedEventBeforeEdit,
                serverVersion,
                conflicting: !areEventsEqual(capturedEventBeforeEdit, serverVersion)
            };
        });

        return states;

    }, [ localEvents, getCapturedEvent ]);

    useEffect(() =>
    {
        if (!pushDialogOpen) { return; }
        checkEventCollisionStates().then(setCollisionStates);
    }, [ pushDialogOpen, checkEventCollisionStates, setCollisionStates ]);

    return (
        <Dialog open={ pushDialogOpen } onClose={ onClose } maxWidth="lg" fullWidth>
            <DialogTitle>שמירת שינויים לוקלים</DialogTitle>

            <form onSubmit={ submitHandler }>
                <DialogContent>
                    <Box sx={ { display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 } }>
                        <Box gap={ 2 } display={ 'flex' } width={ '100%' }>
                            <EventCollisionsList collisionStates={ collisionStates } />
                        </Box>
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button onClick={ () => { } } color='warning'>שחזר</Button>
                    <Button onClick={ onClose } color='secondary'>ביטול</Button>
                    <Button
                        type="submit"
                        color='success'
                        variant="contained"
                    >
                        שמור
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
