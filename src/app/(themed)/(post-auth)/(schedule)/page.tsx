'use client';

import ScheduleAppBar from '@/components/header/app-bar';
import BluzCalendar from '@/components/schedule/calendar/calendar';
import { useCalendar } from '@/components/schedule/calendar/calendar-provider';
import EventDialog from '@/components/schedule/event-dialog';
import PushOfflineUpdatesDialog from '@/components/schedule/offline-dialogs/push-updates-dialog';
import SettingsDialog from "@/components/settings-dialog/settings-dialog";
import { Event, EventId } from "@/components/schedule/types/event";
import { Box } from '@mui/material';
import { SetStateAction, useCallback, useEffect, useState } from 'react';

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
    const [ selectedEvent, setSelectedEvent ] = useState<Partial<Event>>();
    const [ openEventDialog, setOpenEventDialog ] = useState<boolean>(false);
    const [ openSettingsDialog, setOpenSettingsDialog ] = useState<boolean>(false);

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
    }, [ undo, redo ]);

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

    const onEventChange = useCallback((action: SetStateAction<Partial<Event>>) =>
    {
        setSelectedEvent((prev) =>
        {
            const updates = typeof action === 'function'
                ? (action as (prev: Partial<Event>) => Partial<Event>)(prev ?? {})
                : action;
            return prev ? { ...prev, ...updates } : (updates as Partial<Event>);
        });
    }, []);

    // 5. Render
    return (
        <Box sx={ { p: 0 } } width="100vw" height="100vh" display="flex" flexDirection="column">
            <ScheduleAppBar setOpenSettingsDialog={ setOpenSettingsDialog } />

            <BluzCalendar
                events={ events }
                handleSaveEvent={ handleSave }
                handleDeleteEvent={ handleDelete }
                setOpenEventDialog={ setOpenEventDialog }
                setSelectedEvent={ setSelectedEvent }
            />

            <EventDialog
                open={ openEventDialog }
                event={ selectedEvent || {} }
                onClose={ handleCloseEventDialog }
                onSave={ handleSave }
                onEventChange={ onEventChange }
                onDelete={ handleDelete }
            />

            <PushOfflineUpdatesDialog />

            <SettingsDialog
                open={ openSettingsDialog }
                onClose={ () => setOpenSettingsDialog(false) }
            />
        </Box>
    );
}
