import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import dayjs, { Dayjs } from "dayjs";
import { useMemo } from "react";
import { CalendarProps, View, Views } from "react-big-calendar";

import { GanttDayIndex, getDayNameDisplay, HEBREW_DAYS_SHORT } from "@/api-shared/types/gantt/models/day";
import { Room, roomLikeToResourceKey, RoomSource } from "@/api-shared/types/room"; // Import the full Room type and the stable resource-key helper
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

function CalendarHeader({ date }: { date: Date }) {
    const dayIndex = date.getDay();
    const dayFull = getDayNameDisplay(dayIndex as GanttDayIndex);
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
                <Box
                    component="span"
                    sx={{ display: { xs: "none", sm: "inline" } }}
                >
                    {dayFull}
                </Box>
                <Box
                    component="span"
                    sx={{ display: { xs: "inline", sm: "none" } }}
                >
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
    const components = useMemo(
        () => ({
            event: BluzEventComponent,
            toolbar: (props: any) => (
                <CalendarToolbar
                    {...props}
                    onToggleFullscreen={onToggleFullscreen}
                    onToggleToolbar={onToggleToolbar}
                    showToolbar={showToolbar}
                />
            ),
            header: CalendarHeader,
        }),
        [onToggleFullscreen, onToggleToolbar, showToolbar],
    );

    return (
        <DnDCalendar
            className="relative grow h-full"
            components={components}
            date={date}
            defaultView={Views.WEEK}
            draggableAccessor={(e) => !e.locked}
            endAccessor={(e) => (e.endTime as Dayjs).toDate()}
            events={events}
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
                },
            }}
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
                    ? event.rooms.map((room) => roomLikeToResourceKey(room))
                    : [
                        roomLikeToResourceKey({
                            id: DUMMY_ROOM_ID,
                            source: RoomSource.Custom,
                        }),
                    ]
            }
            resourceIdAccessor={(room: Room) => roomLikeToResourceKey(room)}
            // Resource logic
            resources={
                currentView === Views.DAY
                    ? [NO_ROOM_RESOURCE, ...rooms]
                    : undefined
            }
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
