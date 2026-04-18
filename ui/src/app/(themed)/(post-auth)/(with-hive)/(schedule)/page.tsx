"use client";

import { Box } from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import { BluzCalendar } from "@/components/schedule/calendar/calendar";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import { makeEvent } from "@/components/schedule/calendar/calendar-provider/MakeEvent";
import { EventDialog } from "@/components/schedule/event-dialog";
import { PushOfflineUpdatesDialog } from "@/components/schedule/offline-dialogs/push-updates-dialog";
import { Event, EventId } from "@/components/schedule/types/event";

export default function SchedulePage() {
  const { events, saveEvent, deleteEvent, undo, redo } = useCalendar();

  const [selectedEvent, setSelectedEvent] = useState<Event>();
  const [openEventDialog, setOpenEventDialog] = useState<boolean>(false);

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
      if (!isInput && e.key === "Delete" && selectedEvent?.id !== undefined) {
        e.preventDefault();
        deleteEvent(selectedEvent.id);
        setSelectedEvent(undefined);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, deleteEvent, selectedEvent]);

  // 4. Clean UI Handlers
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
        event={selectedEvent ?? makeEvent()}
        onClose={handleCloseEventDialog}
        onDelete={handleDelete}
        onSave={handleSave}
        open={openEventDialog}
      />

      <PushOfflineUpdatesDialog />
    </Box>
  );
}
