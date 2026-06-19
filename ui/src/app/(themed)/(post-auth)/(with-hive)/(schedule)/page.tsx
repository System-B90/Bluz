"use client";
import Box from "@mui/material/Box";
import { useCallback, useEffect, useRef, useState } from "react";

import { BluzCalendar } from "@/components/schedule/calendar/calendar";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import { EventDialog } from "@/components/schedule/event-dialog";
import { PushOfflineUpdatesDialog } from "@/components/schedule/offline-dialogs/push-updates-dialog";
import { Event, EventId } from "@/components/schedule/types/event";

export default function SchedulePage() {
    const {
        events,
        eventLocks,
        saveEvent,
        deleteEvent,
        lockEvent,
        unlockEvent,
        undo,
        redo,
    } = useCalendar();

    const [selectedEvent, setSelectedEvent] = useState<Partial<Event>>();
    const [openEventDialog, setOpenEventDialog] = useState<boolean>(false);

    // Period locking: broadcast a lock while an existing event's dialog is open,
    // and release it on close. Tracks the locked id so the matching unlock fires
    // regardless of how the dialog was opened/closed.
    const lockedEventIdRef = useRef<EventId | null>(null);
    useEffect(() => {
        const openId =
            openEventDialog && selectedEvent?.id ? selectedEvent.id : null;

        if (lockedEventIdRef.current === openId) return;

        if (lockedEventIdRef.current !== null) {
            unlockEvent(lockedEventIdRef.current);
        }
        if (openId !== null) {
            lockEvent(openId);
        }
        lockedEventIdRef.current = openId;
    }, [openEventDialog, selectedEvent, lockEvent, unlockEvent]);

    // Release any held lock when leaving the page.
    useEffect(() => {
        return () => {
            if (lockedEventIdRef.current !== null) {
                unlockEvent(lockedEventIdRef.current);
                lockedEventIdRef.current = null;
            }
        };
    }, [unlockEvent]);

    const lockedBy =
        selectedEvent?.id !== undefined
            ? eventLocks[selectedEvent.id]?.lockedByName
            : undefined;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Guard: Don't trigger undo/redo if the user is typing inside an input/textarea
            const activeTag = document.activeElement?.tagName.toLowerCase();
            const isInput = activeTag === "input" || activeTag === "textarea";

            if (!isInput && e.ctrlKey && e.key === "z") {
                e.preventDefault();
                undo();
            }
            if (!isInput && e.ctrlKey && e.key === "y") {
                e.preventDefault();
                redo();
            }
            if (
                !isInput &&
                e.key === "Delete" &&
                selectedEvent?.id !== undefined
            ) {
                e.preventDefault();
                deleteEvent(selectedEvent.id);
                setSelectedEvent(undefined);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [undo, redo, deleteEvent, selectedEvent]);

    const handleCloseEventDialog = useCallback(() => {
        setOpenEventDialog(false);
        setSelectedEvent(undefined);
    }, []);

    const handleSave = useCallback(
        (event: Partial<Event>) => {
            saveEvent(event); // Provider handles API, offline, and history tracking
            handleCloseEventDialog();
        },
        [saveEvent, handleCloseEventDialog],
    );

    const handleDelete = useCallback(
        (eventId: EventId) => {
            deleteEvent(eventId); // Provider handles API, offline, and history tracking
            handleCloseEventDialog();
        },
        [deleteEvent, handleCloseEventDialog],
    );

    return (
        <Box display={"flex"} flexDirection={"column"} height={"100%"}>
            <BluzCalendar
                events={events}
                handleDeleteEvent={handleDelete}
                handleSaveEvent={handleSave}
                setOpenEventDialog={setOpenEventDialog}
                setSelectedEvent={setSelectedEvent}
            />

            <EventDialog
                event={selectedEvent ?? {}}
                key={selectedEvent?.id}
                lockedByName={lockedBy}
                onClose={handleCloseEventDialog}
                onDelete={handleDelete}
                onSave={handleSave}
                open={openEventDialog}
            />

            <PushOfflineUpdatesDialog />
        </Box>
    );
}
