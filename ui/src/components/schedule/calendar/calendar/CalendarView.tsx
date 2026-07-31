import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import dayjs, { Dayjs } from "dayjs";
import { createContext, useContext, useMemo } from "react";
import {
    CalendarProps,
    SlotInfo,
    ToolbarProps,
    View,
    Views,
} from "react-big-calendar";
import type { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";

import { GanttDayIndex, getDayNameDisplay, HEBREW_DAYS_SHORT } from "@/api-shared/types/gantt/models/day";
import { Room, roomLikeToResourceKey, RoomSource } from "@/api-shared/types/room"; // Import the full Room type and the stable resource-key helper
import { useSettings } from "@/components/base/SettingsProvider";
import { CALENDAR_MESSAGES } from "@/components/CalendarMessages";
import { CalendarToolbar } from "@/components/schedule/calendar/calendar/CalendarToolbar";
import {
    DnDCalendar,
    localizer,
} from "@/components/schedule/calendar/calendar/DndLocalizer";
import { CustomWorkWeek } from "@/components/schedule/calendar/CustomWorkWeek";
import { BluzEventComponent } from "@/components/schedule/event-component/base";
import { Event, EventType } from "@/components/schedule/types/event";

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

type ToolbarExtras = {
    showToolbar: boolean;
    onToggleFullscreen: () => void;
    onToggleToolbar: () => void;
    onExportIcs: () => void;
};

const ToolbarExtrasContext = createContext<null | ToolbarExtras>(null);

/**
 * react-big-calendar treats `components` values as component *types*, so React
 * reconciles the toolbar by function identity: a new reference remounts the
 * whole subtree and re-runs its mount effects (IterationSelector's iteration
 * fetch among them). Defining this at module scope keeps the identity fixed for
 * the process lifetime, and the props that do change travel through context —
 * which re-renders the toolbar without remounting it. See #337.
 */
function CalendarToolbarSlot(props: ToolbarProps<Event, object>) {
    const extras = useContext(ToolbarExtrasContext);
    if (!extras) return null;

    return (
        <CalendarToolbar
            {...props}
            onExportIcs={extras.onExportIcs}
            onToggleFullscreen={extras.onToggleFullscreen}
            onToggleToolbar={extras.onToggleToolbar}
            showToolbar={extras.showToolbar}
        />
    );
}

const CALENDAR_COMPONENTS = {
    event: BluzEventComponent,
    toolbar: CalendarToolbarSlot,
    header: CalendarHeader,
};

/**
 * Expands events flagged `splitAcrossBreaks` that overlap a same-day break
 * (הפסקה) event into multiple render-only blocks — one per side of each
 * break window they span — so the calendar shows a visible gap instead of
 * overlapping the break. All blocks share the real event's id (clicking any
 * of them opens the same edit dialog); every block after the first is
 * flagged `continuationOfBreak` so it renders as bare color, no text (#feat
 * split-across-breaks). Purely a display transform: the underlying event
 * keeps its single stored startTime/endTime.
 */
function splitEventsAroundBreaks(events: Array<Event>): Array<Event> {
    const breakWindowsByDay = new Map<string, Array<{ start: Dayjs; end: Dayjs }>>();
    for (const event of events) {
        if (event.type !== EventType.BREAK) continue;
        const day = (event.startTime as Dayjs).format("YYYY-MM-DD");
        const arr = breakWindowsByDay.get(day) ?? [];
        arr.push({ start: event.startTime as Dayjs, end: event.endTime as Dayjs });
        breakWindowsByDay.set(day, arr);
    }

    const result: Array<Event> = [];
    for (const event of events) {
        if (!event.splitAcrossBreaks || event.type === EventType.BREAK) {
            result.push(event);
            continue;
        }

        const day = (event.startTime as Dayjs).format("YYYY-MM-DD");
        const windows = (breakWindowsByDay.get(day) ?? [])
            .filter(
                (w) =>
                    (event.startTime as Dayjs).isBefore(w.end) &&
                    (event.endTime as Dayjs).isAfter(w.start),
            )
            .sort((a, b) => a.start.valueOf() - b.start.valueOf());

        if (windows.length === 0) {
            result.push(event);
            continue;
        }

        let cursor = event.startTime as Dayjs;
        let isFirst = true;
        for (const window of windows) {
            if (cursor.isBefore(window.start)) {
                result.push({
                    ...event,
                    startTime: cursor,
                    endTime: window.start,
                    ...(isFirst ? {} : { continuationOfBreak: true }),
                });
                isFirst = false;
            }
            cursor = window.end;
        }
        if (cursor.isBefore(event.endTime as Dayjs)) {
            result.push({
                ...event,
                startTime: cursor,
                endTime: event.endTime,
                ...(isFirst ? {} : { continuationOfBreak: true }),
            });
        }
    }
    return result;
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
    onSelectSlot: (slotInfo: SlotInfo) => void;
    onEventDrop: (args: EventInteractionArgs<Event>) => void;
    onToggleFullscreen: () => void;
    onToggleToolbar: () => void;
    onExportIcs: () => void;
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
    onExportIcs,
}: CalendarViewProps) {
    const toolbarExtras = useMemo(
        () => ({ showToolbar, onToggleFullscreen, onToggleToolbar, onExportIcs }),
        [showToolbar, onToggleFullscreen, onToggleToolbar, onExportIcs],
    );

    const displayEvents = useMemo(() => splitEventsAroundBreaks(events), [events]);

    const { calendarDayStartTime, calendarDayEndTime } = useSettings();
    const calendarMin = useMemo(
        () => dayjs(calendarDayStartTime, "HH:mm").toDate(),
        [calendarDayStartTime],
    );
    const calendarMax = useMemo(
        () => dayjs(calendarDayEndTime, "HH:mm").toDate(),
        [calendarDayEndTime],
    );

    return (
        <ToolbarExtrasContext.Provider value={toolbarExtras}>
            <DnDCalendar
                className="relative grow h-full"
                components={CALENDAR_COMPONENTS}
                date={date}
                defaultView={Views.WEEK}
                draggableAccessor={(e) => !e.locked && !e.continuationOfBreak}
                endAccessor={(e) => (e.endTime as Dayjs).toDate()}
                events={displayEvents}
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
                max={calendarMax}
                messages={CALENDAR_MESSAGES}
                min={calendarMin}
                onDoubleClickEvent={onDoubleClickEvent}
                onEventDrop={onEventDrop}
                onEventResize={onEventDrop}
                onNavigate={onNavigate}
                onSelectEvent={onSelectEvent}
                onSelectSlot={onSelectSlot}
                onView={onView}
                resizableAccessor={(e) => !e.locked && !e.continuationOfBreak}
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
        </ToolbarExtrasContext.Provider>
    );
}
