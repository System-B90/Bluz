/**
 * Name: BluzCalendar.tsx
 * Purpose: Entry point for the Bluz Schedule Calendar.
 * Created: 2026-04-18
 * Author: Michael K. Steinberg
 */

"use client";

import {
    Dispatch,
    SetStateAction,
    useCallback,
    useEffect,
    useState,
} from "react";
import { View, Views } from "react-big-calendar";

import { useRooms } from "@/components/base/RoomsProvider";
import { CalendarView } from "@/components/schedule/calendar/calendar/CalendarView";
import { useCalendarHandlers } from "@/components/schedule/calendar/calendar/UseCalendarHandlers";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import { getRangeForView } from "@/components/schedule/calendar/utils";
import { Event } from "@/components/schedule/types/event";

type BluzCalendarProps = {
  handleSaveEvent: (event: Event) => void;
  handleDeleteEvent: (eventId: Event["id"]) => void;
  setOpenEventDialog: (open: boolean) => void;
  setSelectedEvent: Dispatch<SetStateAction<Event | undefined>>;
  events: Array<Event>;
}

export function BluzCalendar({
    handleSaveEvent,
    handleDeleteEvent,
    setOpenEventDialog,
    setSelectedEvent,
    events,
}: BluzCalendarProps) {
    const [mounted, setMounted] = useState(false);
    const [currentView, setCurrentView] = useState<View>(Views.WEEK);

    const { rooms } = useRooms();
    const { setStartDate, setEndDate } = useCalendar();

    const { handleEventDrag, handleSlotSelect, setActiveEvent } =
    useCalendarHandlers(
        events,
        handleSaveEvent,
        handleDeleteEvent,
        setSelectedEvent,
        setOpenEventDialog,
    );

    // Only render the calendar after the component has mounted on the client.
    useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, []);

    const updateDateRange = useCallback(
        (date: Date, view: View) => {
            const { start, end } = getRangeForView(date, view);
            setStartDate(start);
            setEndDate(end);
        },
        [setStartDate, setEndDate],
    );

    const onNavigate = useCallback(
        (newDate: Date, view: View) => {
            updateDateRange(newDate, view);
        },
        [updateDateRange],
    );

    useEffect(() => {
        updateDateRange(new Date(), currentView);
    }, [currentView, updateDateRange]);

    const handleEditEvent = useCallback(
        (event: Event) => {
            setSelectedEvent(event);
            setOpenEventDialog(true);
        },
        [setSelectedEvent, setOpenEventDialog],
    );

    const handleSelectEvent = useCallback(
        (event: Event) => {
            setActiveEvent(event);
            setSelectedEvent(event);
        },
        [setSelectedEvent, setActiveEvent],
    );

    if (!mounted)
        return <div className="grow h-full bg-slate-50/50 animate-pulse" />;

    return (
        <CalendarView
            currentView={currentView}
            events={events}
            onDoubleClickEvent={handleEditEvent}
            onEventDrop={handleEventDrag}
            onNavigate={onNavigate}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSlotSelect}
            onView={setCurrentView}
            rooms={rooms}
        />
    );
}
