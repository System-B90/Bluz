'use client';

import { apiDeleteEvent, apiSaveEvent } from '@/api-client/calendar';
import { enqueueApiErrorSnackbar } from '@/api-client/common';
import ScheduleAppBar from '@/components/header/app-bar';
import BluzCalendar from '@/components/schedule/calendar';
import { useCalendar } from '@/components/schedule/calendar-provider';
import EventDialog from '@/components/schedule/event-dialog';
import SettingsDialog from "@/components/settings-dialog/settings-dialog";
import { Event } from "@/components/schedule/types/event";
import { Box } from '@mui/material';
import { useHistoryState } from "@uidotdev/usehooks";
import dayjs from 'dayjs';
import 'dayjs/locale/he';
import { enqueueSnackbar } from 'notistack';
import { SetStateAction, useCallback, useEffect, useState } from 'react';

export default function SchedulePage()
{
    const { events: serverEvents } = useCalendar();
    const {
        state: events,
        set: setEvents,
        undo,
        redo,
    } = useHistoryState<Array<Event>>(serverEvents);

    const [ selectedEvent, setSelectedEvent ] = useState<Partial<Event>>();
    const [ openEventDialog, setOpenEventDialog ] = useState<boolean>(false);
    const [ openSettingsDialog, setOpenSettingsDialog ] = useState<boolean>(false);

    useEffect(() =>
    {
        const handleKeyDown = (e: KeyboardEvent) =>
        {
            if (e.ctrlKey && e.key === 'z') { undo(); };
            if (e.ctrlKey && e.key === 'y') { redo(); };
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [ undo, redo ]);

    useEffect(() =>
    {
        setEvents(serverEvents);
    }, [ serverEvents, setEvents ]);


    const handleSaveEvent = useCallback((event: Partial<Event>): void =>
    {
        if (!event || event.name === '') { return; }

        const newEvent: Event = {
            id: event.id,
            name: event.name || '',
            subject: event.subject ?? 0,
            hiveModule: event.hiveModule ?? 0,
            startTime: event.startTime || dayjs(),
            endTime: event.endTime || dayjs(),
            type: event.type || 'exercise',
            courses: event.courses || [],
            rooms: event.rooms?.map((v) => typeof v === 'string' ? parseInt(v) : v) || [],
            instructors: event.instructors || [],
            lecturers: event.lecturers || [],
            tags: event.tags || [],
            notes: event.notes || '',
            locked: event.locked || false,
            required: event.required || false,
            hidden: event.hidden || false,
            personalTalk: event.personalTalk || false,
        } as Event;

        if (newEvent.id)
        {
            setEvents([ ...events.filter(pp => pp.id !== newEvent.id), newEvent ]);
        }

        setOpenEventDialog(false);

        apiSaveEvent(newEvent)
            .then((p) =>
            {
                enqueueSnackbar(`המופע "${p.name}" נשמר בהצלחה!`, { variant: 'success' });
                setEvents([ ...events.filter(pp => pp.id !== newEvent.id), p ]);
            })
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'שמירת המופע נכשלה!', error));
    }, [ events, setEvents, setOpenEventDialog ]);

    const handleCloseEventDialog = useCallback((): void =>
    {
        setOpenEventDialog(false);
        setSelectedEvent(undefined);
    }, [ setOpenEventDialog, setSelectedEvent ]);

    const onEventChange = useCallback((action: SetStateAction<Partial<Event>>) =>
    {
        setSelectedEvent((prev) =>
        {
            // 1. Resolve the value. If 'action' is a function, call it with the previous state.
            // We fallback to {} if prev is null/undefined to ensure the function receives an object.
            const updates = typeof action === 'function'
                ? (action as (prev: Partial<Event>) => Partial<Event>)(prev || {})
                : action;

            // 2. Apply the merge logic you had originally
            // (If state exists, merge updates; otherwise, just use updates)
            return prev ? { ...prev, ...updates } : (updates as Event);
        });
    }, [ setSelectedEvent ]);

    const onEventDelete = useCallback((eventId: Event[ 'id' ]) =>
    {
        apiDeleteEvent(eventId)
            .then(() => enqueueSnackbar('המופע נמחק בהצלחה.', { variant: 'success' }))
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'מחיקת המופע נכשלה!', error));

        setOpenEventDialog(false);
        setSelectedEvent(undefined);
    }, [ setOpenEventDialog, setSelectedEvent ]);

    return (
        <Box sx={ { p: 0 } } width={ '100vw' } height={ '100vh' } display={ 'flex' } flexDirection={ 'column' }>
            <ScheduleAppBar setOpenSettingsDialog={ setOpenSettingsDialog } />
            <BluzCalendar handleSaveEvent={ handleSaveEvent } setOpenEventDialog={ setOpenEventDialog } setSelectedEvent={ setSelectedEvent } events={ events } />

            <EventDialog
                open={ openEventDialog }
                event={ selectedEvent || {} }
                onClose={ handleCloseEventDialog }
                onSave={ handleSaveEvent }
                onEventChange={ onEventChange }
                onDelete={ onEventDelete }
            />

            <SettingsDialog open={ openSettingsDialog } onClose={ () => { setOpenSettingsDialog(false); } } />
        </Box>
    );
}
