import React from "react";
import {Calendar, momentLocalizer, Views, View, SlotInfo, DateLocalizer, CalendarProps} from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import {Period, Room} from "@/components/schedule/types";
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';


// const TypedCalendar = Calendar as unknown as React.ComponentType<CalendarProps<Period, Room>>;
const DnDCalendar = withDragAndDrop<Period, Room>(Calendar);

// Define props interface
export interface ScheduleProps {
    localizer: DateLocalizer;
    events: Period[];
    defaultView: View;
    selectable?: boolean;
    setEventEditOpen: (open: boolean) => void;
    setSelectedEvent: (period: Period) => void;
    onSlotSelect?: (slotInfo: SlotInfo) => void;

    style?: React.CSSProperties;
}

export default function Schedule({
    localizer,
    events,
    defaultView,
    selectable,
    setEventEditOpen,
    setSelectedEvent,
    onSlotSelect,
    style,
}: ScheduleProps): any {
    return (
        <div style={style}>
            <DnDCalendar
                localizer={localizer}
                events={events}
                defaultView={defaultView}
                views={[Views.DAY, Views.WEEK]} // restrict to day/week
                selectable={selectable}
                resizable
                onSelectEvent={setSelectedEvent}
                onSelectSlot={onSlotSelect}
                // onDoubleClickEvent={(event: Period)=>{setSelectedEvent(event);setEventEditOpen(true)}}
                startAccessor="startTime"
                endAccessor="endTime"
                style={{ height: "100%" }}

            />
        </div>
    );
};
