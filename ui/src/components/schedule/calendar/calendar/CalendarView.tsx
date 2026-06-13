/**
 * Name: CalendarView.tsx
 * Purpose: Presentation layer for the Big Calendar with corrected generic types.
 * Created: 2026-04-18
 * Author: Michael K. Steinberg
 */

import { Box, Typography } from "@mui/material";
import dayjs, { Dayjs } from "dayjs";
import { CalendarProps, View, Views } from "react-big-calendar";

import { Room, RoomSource, roomToResolvable } from "@/api-shared/types/room"; // Import the full Room type and roomToResolvable
import { CALENDAR_MESSAGES } from "@/components/CalendarMessages";
import { CalendarToolbar } from "@/components/schedule/calendar/calendar/CalendarToolbar";
import {
    DnDCalendar,
    localizer,
} from "@/components/schedule/calendar/calendar/DndLocalizer";
import { CustomWorkWeek } from "@/components/schedule/calendar/CustomWorkWeek";
import { BluzEventComponent } from "@/components/schedule/event-component/base";
import { Event } from "@/components/schedule/types/event";

const DUMMY_ROOM_ID = "no-room-unassigned";
const NO_ROOM_RESOURCE: Room = {
    id: DUMMY_ROOM_ID,
    name: "ללא כיתה",
    source: RoomSource.Custom,
};

const HEBREW_DAYS_FULL = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HEBREW_DAYS_SHORT = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

function CalendarHeader({ date }: { date: Date }) {
    const dayIndex = date.getDay();
    const dayFull = HEBREW_DAYS_FULL[dayIndex];
    const dayShort = HEBREW_DAYS_SHORT[dayIndex];
    const dayjsDate = dayjs(date);
    const dateStr = dayjsDate.format("DD/MM");
    const isToday = dayjsDate.isSame(dayjs(), "day");

    return (
        <Box
            alignItems="center"
            display="flex"
            gap={1}
            justifyContent="center"
            py={0.75}
            sx={{
                width: "100%",
                minHeight: 38,
            }}
        >
            <Typography
                component="span"
                sx={{
                    fontSize: "0.875rem",
                    fontWeight: isToday ? "bold" : 600,
                    color: isToday ? "primary.main" : "text.primary",
                }}
            >
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                    {dayFull}
                </Box>
                <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>
                    {dayShort}
                </Box>
            </Typography>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    fontWeight: isToday ? "bold" : 500,
                    bgcolor: isToday ? "primary.main" : "action.hover",
                    color: isToday ? "primary.contrastText" : "text.secondary",
                    px: 1,
                    py: 0.25,
                }}
            >
                {dateStr}
            </Box>
        </Box>
    );
}

type CalendarViewProps = {
    events: Array<Event>;
    rooms: Array<Room>;
    currentView: View;
    date: Date;
    showToolbar: boolean;
    onView: (view: View) => void;
    onNavigate: CalendarProps["onNavigate"];
    onSelectEvent: (event: Event) => void;
    onDoubleClickEvent: (event: Event) => void;
    onSelectSlot: (slotInfo: any) => void;
    onEventDrop: (args: any) => void;
    onToggleFullscreen: () => void;
    onToggleToolbar: () => void;
};

export function CalendarView({
    events,
    rooms,
    currentView,
    date,
    showToolbar,
    onView,
    onNavigate,
    onSelectEvent,
    onDoubleClickEvent,
    onSelectSlot,
    onEventDrop,
    onToggleFullscreen,
    onToggleToolbar,
}: CalendarViewProps) {
    return (
        <DnDCalendar
            className="relative grow h-full"
            components={{ 
                event: BluzEventComponent, 
                toolbar: (props: any) => (
                    <CalendarToolbar 
                        {...props} 
                        onToggleFullscreen={onToggleFullscreen} 
                        onToggleToolbar={onToggleToolbar} 
                        showToolbar={showToolbar}
                    />
                ),
                header: CalendarHeader
            }}
            date={date}
            defaultView={Views.WEEK}
            draggableAccessor={(e) => !e.locked}
            endAccessor={(e) => (e.endTime as Dayjs).toDate()}
            formats={{
                timeGutterFormat: "HH:mm",
                dayRangeHeaderFormat: ({ start, end }) => {
                    const s = dayjs(start).locale("he");
                    const e = dayjs(end).locale("he");
                    if (s.month() === e.month()) {
                        return `${s.format("DD")} - ${e.format("DD")} ב${s.format("MMMM")} ${s.format("YYYY")}`;
                    } else {
                        return `${s.format("DD")} ב${s.format("MMMM")} - ${e.format("DD")} ב${e.format("MMMM")} ${e.format("YYYY")}`;
                    }
                }
            }}
            events={events}
            localizer={localizer}
            max={new Date(2025, 0, 1, 22, 0)}
            messages={CALENDAR_MESSAGES}
            min={new Date(2025, 0, 1, 7, 0)}
            onDoubleClickEvent={onDoubleClickEvent}
            onEventDrop={onEventDrop}
            onEventResize={onEventDrop}
            onNavigate={onNavigate}
            onSelectEvent={onSelectEvent}
            onSelectSlot={onSelectSlot}
            onView={onView}
            resizableAccessor={(e) => !e.locked}
            resourceAccessor={(event: Event) =>
                event.rooms.length > 0
                    ? event.rooms.map((room) => JSON.stringify(room))
                    : [JSON.stringify({ id: DUMMY_ROOM_ID, source: RoomSource.Custom })]
            }
            resourceIdAccessor={(room: Room) => JSON.stringify(roomToResolvable(room))}
            // Resource logic
            resources={currentView === Views.DAY ? [NO_ROOM_RESOURCE, ...rooms] : undefined}
            resourceTitleAccessor="name"
            rtl={true}
            selectable
            startAccessor={(e) => (e.startTime as Dayjs).toDate()}
            step={5}
            style={{ height: "100%" }}
            timeslots={12}
            view={currentView}
            views={{ day: true, week: true, work_week: CustomWorkWeek }}
        />
    );
}
