/**
 * Name: CalendarView.tsx
 * Purpose: Presentation layer for the Big Calendar with corrected generic types.
 * Created: 2026-04-18
 * Author: Michael K. Steinberg
 */

import { Dayjs } from "dayjs";
import { CalendarProps, View, Views } from "react-big-calendar";

import { Room } from "@/api-shared/types/room"; // Import the full Room type
import { CALENDAR_MESSAGES } from "@/components/CalendarMessages";
import
{
    DnDCalendar,
    localizer,
} from "@/components/schedule/calendar/calendar/DndLocalizer";
import { CustomWorkWeek } from "@/components/schedule/calendar/CustomWorkWeek";
import { BluzEventComponent } from "@/components/schedule/event-component/base";
import { Event } from "@/components/schedule/types/event";

type CalendarViewProps = {
    events: Array<Event>;
    rooms: Array<Room>;
    currentView: View;
    onView: (view: View) => void;
    onNavigate: CalendarProps[ "onNavigate" ];
    onSelectEvent: (event: Event) => void;
    onDoubleClickEvent: (event: Event) => void;
    onSelectSlot: (slotInfo: any) => void;
    onEventDrop: (args: any) => void;
};

export function CalendarView({
    events,
    rooms,
    currentView,
    onView,
    onNavigate,
    onSelectEvent,
    onDoubleClickEvent,
    onSelectSlot,
    onEventDrop,
}: CalendarViewProps)
{
    return (
        <DnDCalendar
            className="relative grow h-full"
            components={ { event: BluzEventComponent } }
            defaultView={ Views.WEEK }
            draggableAccessor={ (e) => !e.locked }
            endAccessor={ (e) => (e.endTime as Dayjs).toDate() }
            events={ events }
            formats={ { timeGutterFormat: "HH:mm" } }
            localizer={ localizer }
            max={ new Date(2025, 0, 1, 22, 0) }
            messages={ CALENDAR_MESSAGES }
            min={ new Date(2025, 0, 1, 7, 0) }
            onDoubleClickEvent={ onDoubleClickEvent }
            onEventDrop={ onEventDrop }
            onEventResize={ onEventDrop }
            onNavigate={ onNavigate }
            onSelectEvent={ onSelectEvent }
            onSelectSlot={ onSelectSlot }
            onView={ onView }
            resizableAccessor={ (e) => !e.locked }
            resourceAccessor={ (event: Event) => event.rooms }
            resourceIdAccessor="id"
            // Resource logic
            resources={ currentView === Views.DAY ? rooms : undefined }
            resourceTitleAccessor="name"
            rtl={ true }
            selectable
            startAccessor={ (e) => (e.startTime as Dayjs).toDate() }
            step={ 5 }
            style={ { height: "unset" } }
            timeslots={ 12 }
            views={ { day: true, week: true, work_week: CustomWorkWeek } }
        />
    );
}
