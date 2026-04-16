'use client';

import { Box } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';

import BluzCalendar from '@/components/schedule/calendar/calendar';
import { makeEvent, useCalendar } from '@/components/schedule/calendar/calendar-provider';
import EventDialog from '@/components/schedule/event-dialog';
import PushOfflineUpdatesDialog from '@/components/schedule/offline-dialogs/push-updates-dialog';
import { Event, EventId } from "@/components/schedule/types/event";

export default function SchedulePage()
{
    // 1. Consume the domain logic from our unified Provider
    const {
        events,
        saveEvent,
        deleteEvent,
        undo,
        redo
    } = useCalendar();

    // 2. Local UI State (Dialogs & Selected Item)
    const [ selectedEvent, setSelectedEvent ] = useState<Event>();
    const [ openEventDialog, setOpenEventDialog ] = useState<boolean>(false);

    // 3. Global Keyboard Shortcuts
    useEffect(() =>
    {
        const handleKeyDown = (e: KeyboardEvent) =>
        {
            // Guard: Don't trigger undo/redo if the user is typing inside an input/textarea
            const activeTag = document.activeElement?.tagName.toLowerCase();
            const isInput = activeTag === 'input' || activeTag === 'textarea';

            if (!isInput && e.ctrlKey && e.key === 'z')
            {
                e.preventDefault();
                undo();
            }
            if (!isInput && e.ctrlKey && e.key === 'y')
            {
                e.preventDefault();
                redo();
            }
            if (!isInput && e.key === 'Delete' && selectedEvent?.id !== undefined)
            {
                e.preventDefault();
                deleteEvent(selectedEvent.id);
                setSelectedEvent(undefined);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [ undo, redo, deleteEvent, selectedEvent, ]);

    // 4. Clean UI Handlers
    const handleCloseEventDialog = useCallback(() =>
    {
        setOpenEventDialog(false);
        setSelectedEvent(undefined);
    }, []);

    const handleSave = useCallback((event: Partial<Event>) =>
    {
        saveEvent(event); // Provider handles API, offline, and history tracking
        handleCloseEventDialog();
    }, [ saveEvent, handleCloseEventDialog ]);

    const handleDelete = useCallback((eventId: EventId) =>
    {
        deleteEvent(eventId); // Provider handles API, offline, and history tracking
        handleCloseEventDialog();
    }, [ deleteEvent, handleCloseEventDialog ]);

    return (
        <Box height={ '100%' } display={ 'flex' } flexDirection={ 'column' }>
            <BluzCalendar
                events={ events }
                handleSaveEvent={ handleSave }
                handleDeleteEvent={ handleDelete }
                setOpenEventDialog={ setOpenEventDialog }
                setSelectedEvent={ setSelectedEvent }
            />

            <EventDialog
                open={ openEventDialog }
                event={ selectedEvent ?? makeEvent() }
                onClose={ handleCloseEventDialog }
                onSave={ handleSave }
                onDelete={ handleDelete }
            />

            <PushOfflineUpdatesDialog />
        </Box>
    );
}
