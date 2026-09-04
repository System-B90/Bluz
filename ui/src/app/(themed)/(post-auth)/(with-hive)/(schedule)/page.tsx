"use client";
import Box from "@mui/material/Box";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";

import { EventChangeInitiator } from "@/api-shared/types/event-history";
import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { EmptyState } from "@/components/base/EmptyState";
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";
import { ErrorSurface } from "@/components/errors/ErrorSurface";
import { BluzCalendar } from "@/components/schedule/calendar/calendar";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import { useEventLockLifecycle } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventLockLifecycle";
import { CalendarSkeleton } from "@/components/schedule/calendar/CalendarSkeleton";
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
        isLoadingEvents,
    } = useCalendar();

    const { clearFilters, eventFilteredOpacity, hasActiveFilters } =
        useCalendarFilters();

    // "No events in this range" is the calendar's own (correct) blank week.
    // "Your filters hid all of them" is a different problem with a different
    // fix, so it gets its own surface and a way out.
    const allEventsFiltered =
        !isLoadingEvents &&
        hasActiveFilters &&
        events.length > 0 &&
        events.every((event) => eventFilteredOpacity(event) === 0);

    const [selectedEvent, setSelectedEvent] = useState<Partial<Event>>();
    const [openEventDialog, setOpenEventDialog] = useState<boolean>(false);

    const openId =
        openEventDialog && selectedEvent?.id ? selectedEvent.id : null;

    // Period locking: hold a lock for as long as an existing event's dialog
    // is open, and release it on close (see the hook for the lifecycle).
    useEventLockLifecycle(openId, lockEvent, unlockEvent);

    const lockedBy =
        selectedEvent?.id !== undefined
            ? eventLocks[selectedEvent.id]?.lockedByName
            : undefined;

    // Undo/redo hotkeys are declared on the schedule.undo/redo palette
    // commands (see use-schedule-commands.tsx) and captured globally by
    // useCommandHotkeys — only the Delete key stays local, since it isn't a
    // palette command.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeTag = document.activeElement?.tagName.toLowerCase();
            const isInput = activeTag === "input" || activeTag === "textarea";

            if (
                !isInput &&
                e.key === "Delete" &&
                selectedEvent?.id !== undefined
            ) {
                e.preventDefault();
                deleteEvent(selectedEvent.id, EventChangeInitiator.Keyboard);
                setSelectedEvent(undefined);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [deleteEvent, selectedEvent]);

    // Opened without a calendar slot to seed it, so default to the next
    // half-hour boundary for an hour — the same shape a slot drag produces.
    const handleCreateEvent = useCallback(() => {
        const startTime = dayjs()
            .add(30 - (dayjs().minute() % 30), "minute")
            .second(0)
            .millisecond(0);

        setSelectedEvent({ startTime, endTime: startTime.add(1, "hour") });
        setOpenEventDialog(true);
    }, []);

    const handleCloseEventDialog = useCallback(() => {
        setOpenEventDialog(false);
        setSelectedEvent(undefined);
    }, []);

    const handleSave = useCallback(
        (event: Partial<Event>, initiator?: EventChangeInitiator) => {
            // Provider handles API, offline, and history tracking.
            saveEvent(event, initiator);
            handleCloseEventDialog();
        },
        [saveEvent, handleCloseEventDialog],
    );

    const handleDelete = useCallback(
        (eventId: EventId, initiator?: EventChangeInitiator) => {
            // Provider handles API, offline, and history tracking.
            deleteEvent(eventId, initiator);
            handleCloseEventDialog();
        },
        [deleteEvent, handleCloseEventDialog],
    );

    return (
        <Box
            display={"flex"}
            flexDirection={"column"}
            height={"100%"}
            position={"relative"}
        >
            {isLoadingEvents ? <CalendarSkeleton /> : null}
            {allEventsFiltered ? (
                <Box
                    sx={{
                        position: "absolute",
                        insetInline: 0,
                        top: "40%",
                        zIndex: 3,
                        pointerEvents: "auto",
                        display: "flex",
                        justifyContent: "center",
                    }}
                >
                    <Box sx={{ bgcolor: "background.paper", borderRadius: 2, boxShadow: 3 }}>
                        <EmptyState
                            actionLabel="ניקוי הסינון"
                            hint="יש אירועים בטווח התאריכים הזה, אך הסינון הנוכחי מסתיר את כולם."
                            message="הסינון הסתיר את כל האירועים"
                            onAction={clearFilters}
                            variant="filtered"
                        />
                    </Box>
                </Box>
            ) : null}
            <ErrorBoundary
                fallback={(error, reset) => (
                    <ErrorSurface
                        actions={[
                            { label: "נסו שוב", onClick: reset, variant: "contained" },
                        ]}
                        description="לוח הזמנים נתקל בשגיאה ולא ניתן להציגו כרגע."
                        details={error.message}
                        title="שגיאה בטעינת לוח הזמנים"
                    />
                )}
                scope="calendar"
            >
                <BluzCalendar
                    createEvent={handleCreateEvent}
                    events={events}
                    handleDeleteEvent={handleDelete}
                    handleSaveEvent={handleSave}
                    redo={redo}
                    setOpenEventDialog={setOpenEventDialog}
                    setSelectedEvent={setSelectedEvent}
                    undo={undo}
                />
            </ErrorBoundary>

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
