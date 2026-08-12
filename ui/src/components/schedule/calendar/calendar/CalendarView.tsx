import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
    CalendarProps,
    SlotInfo,
    ToolbarProps,
    View,
    Views,
} from "react-big-calendar";
import type { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";

import {
    breakWindowsFor,
    collectBreakWindows,
    workingMsOf,
} from "@/api-shared/break-windows";
import {
    layoutAroundWindows,
    layoutEnd,
    MIN_SEGMENT_MINUTES,
    workingMsUpTo,
} from "@/api-shared/interval-layout";
import { GanttDayIndex, getDayNameDisplay, HEBREW_DAYS_SHORT } from "@/api-shared/types/gantt/models/day";
import { Room, roomLikeToResourceKey, RoomSource } from "@/api-shared/types/room"; // Import the full Room type and the stable resource-key helper
import { useSettings } from "@/components/base/SettingsProvider";
import { CALENDAR_MESSAGES } from "@/components/CalendarMessages";
import { CalendarToolbar } from "@/components/schedule/calendar/calendar/CalendarToolbar";
import {
    DnDCalendar,
    localizer,
} from "@/components/schedule/calendar/calendar/DndLocalizer";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import { CustomWorkWeek } from "@/components/schedule/calendar/CustomWorkWeek";
import { splitAwareDayLayout } from "@/components/schedule/calendar/split/segment-layout";
import {
    buildEventSegments,
    EventSegment,
    isFirstSegment,
    isLastSegment,
} from "@/components/schedule/calendar/split/segments";
import {
    ActiveDrag,
    SplitCalendarProvider,
} from "@/components/schedule/calendar/split/SplitCalendarContext";
import { BluzEventComponent } from "@/components/schedule/event-component/base";
import { Event, EventId } from "@/components/schedule/types/event";

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
function CalendarToolbarSlot(props: ToolbarProps<EventSegment, object>) {
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

const MIN_WORKING_MS = MIN_SEGMENT_MINUTES * 60_000;

/** Shape react-big-calendar's drag addon reports at `onDragStart`. */
type ActiveDragStart = {
    event: EventSegment;
    action: ActiveDrag["action"];
    direction?: ActiveDrag["direction"] | null;
};

/**
 * Squares off the grid box's cut edges, so a run of pieces reads as one object
 * interrupted by a break rather than as several separate events. Has to reach
 * the `.rbc-event` node itself — rounding it there would clip whatever the
 * event component draws inside.
 */
function segmentPropGetter(segment: EventSegment) {
    const classNames = [
        isFirstSegment(segment) ? "" : "bluz-cut-block-start",
        isLastSegment(segment) ? "" : "bluz-cut-block-end",
    ].filter(Boolean);

    return classNames.length > 0 ? { className: classNames.join(" ") } : {};
}

/** react-big-calendar hands back `string | Date` for the dragged range. */
function toMs(value: Date | string): number {
    return value instanceof Date ? value.getTime() : new Date(value).getTime();
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
    /**
     * Reports a committed grid interaction in event-space. `interaction`
     * distinguishes a move from a resize so the write can be attributed
     * correctly in the event change log.
     */
    onEventDrop: (
        args: EventInteractionArgs<Event>,
        interaction: "move" | "resize",
    ) => void;
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

    const { startDate, endDate } = useCalendar();
    const [ hoveredEventId, setHoveredEventId ] = useState<EventId | null>(null);
    const [ selectedEventId, setSelectedEventId ] = useState<EventId | null>(null);
    const [ activeDrag, setActiveDrag ] = useState<ActiveDrag | null>(null);

    // Breaks are harvested from the *whole* event set: one hidden by a filter
    // or sitting just outside the visible range still interrupts the day.
    const breakWindows = useMemo(() => collectBreakWindows(events), [events]);
    const segments = useMemo(
        () => buildEventSegments(events, breakWindows),
        [events, breakWindows],
    );

    // Scope to the visible range so websocket traffic for off-screen events
    // doesn't force the grid to re-lay-out. Filtering happens on the *drawn*
    // range, which for a split event runs past its stored end.
    const visibleSegments = useMemo(() => {
        if (!startDate || !endDate) return segments;
        return segments.filter(
            (segment) =>
                segment.to.toDate() >= startDate &&
                segment.from.toDate() <= endDate,
        );
    }, [segments, startDate, endDate]);

    const splitCalendar = useMemo(
        () => ({
            breakWindows,
            activeDrag,
            hoveredEventId,
            selectedEventId,
            setHoveredEventId,
        }),
        [breakWindows, activeDrag, hoveredEventId, selectedEventId],
    );

    // A drag that ends outside the grid resolves through neither drop handler,
    // so the "being dragged" styling is also cleared on any pointer release.
    useEffect(() => {
        if (!activeDrag) return;
        const clear = () => setActiveDrag(null);
        window.addEventListener("mouseup", clear);
        return () => window.removeEventListener("mouseup", clear);
    }, [activeDrag]);

    const handleDragStart = useCallback(
        ({ event: segment, action, direction }: ActiveDragStart) => {
            setActiveDrag({
                eventId: segment.event.id,
                action,
                direction: direction ?? undefined,
            });
        },
        [],
    );

    /**
     * Translates a grid interaction on one piece back into a change to the
     * whole event, then reports it in event-space. Everything upstream of the
     * calendar only ever sees canonical events with a net working span.
     */
    const commit = useCallback(
        (
            args: EventInteractionArgs<EventSegment>,
            startMs: number,
            workingMs: number,
            interaction: "move" | "resize",
        ) => {
            setActiveDrag(null);
            onEventDrop(
                {
                    ...args,
                    event: args.event.event,
                    start: new Date(startMs),
                    end: new Date(startMs + Math.max(MIN_WORKING_MS, workingMs)),
                } as unknown as EventInteractionArgs<Event>,
                interaction,
            );
        },
        [onEventDrop],
    );

    const handleSegmentDrop = useCallback(
        (args: EventInteractionArgs<EventSegment>) => {
            const { event, from } = args.event;
            if (event.locked) return;
            // Whichever piece was grabbed, the event moves by the same delta
            // and keeps its working duration; where the breaks fall after the
            // move is a pure re-layout.
            const delta = toMs(args.start) - from.valueOf();
            commit(
                args,
                event.startTime.valueOf() + delta,
                workingMsOf(event),
                "move",
            );
        },
        [commit],
    );

    const handleSegmentResize = useCallback(
        (args: EventInteractionArgs<EventSegment>) => {
            const segment = args.event;
            const { event } = segment;
            if (event.locked) return;

            const windows = breakWindowsFor(event, breakWindows);
            const draggedTopEdge = toMs(args.start) !== segment.from.valueOf();

            if (draggedTopEdge) {
                // The tail stays put on screen and the head moves, so the new
                // duration is however much work now fits before that tail.
                const displayEnd = layoutEnd(
                    layoutAroundWindows(
                        event.startTime.valueOf(),
                        workingMsOf(event),
                        windows,
                    ),
                );
                const startMs = toMs(args.start);
                commit(
                    args,
                    startMs,
                    workingMsUpTo(startMs, displayEnd, windows),
                    "resize",
                );
                return;
            }

            // Bottom edge: the head stays put and the dropped point becomes
            // the drawn end — measured in working time, so the breaks the
            // event steps over are not counted as duration.
            const startMs = event.startTime.valueOf();
            commit(
                args,
                startMs,
                workingMsUpTo(startMs, toMs(args.end), windows),
                "resize",
            );
        },
        [breakWindows, commit],
    );

    const handleSelectSegment = useCallback(
        (segment: EventSegment) => {
            setSelectedEventId(segment.event.id);
            onSelectEvent(segment.event);
        },
        [onSelectEvent],
    );

    const handleDoubleClickSegment = useCallback(
        (segment: EventSegment) => onDoubleClickEvent(segment.event),
        [onDoubleClickEvent],
    );

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
            <SplitCalendarProvider value={splitCalendar}>
                <DnDCalendar
                    className="relative grow h-full"
                    components={CALENDAR_COMPONENTS}
                    date={date}
                    dayLayoutAlgorithm={splitAwareDayLayout}
                    defaultView={Views.WEEK}
                    draggableAccessor={(segment) => !segment.event.locked}
                    endAccessor={(segment) => segment.to.toDate()}
                    eventPropGetter={segmentPropGetter}
                    events={visibleSegments}
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
                    onDoubleClickEvent={handleDoubleClickSegment}
                    onDragStart={handleDragStart}
                    onEventDrop={handleSegmentDrop}
                    onEventResize={handleSegmentResize}
                    onNavigate={onNavigate}
                    onSelectEvent={handleSelectSegment}
                    onSelectSlot={onSelectSlot}
                    onView={onView}
                    resizableAccessor={(segment) => !segment.event.locked}
                    resourceAccessor={(segment: EventSegment) =>
                        segment.event.rooms.length > 0
                            ? segment.event.rooms.map((room) =>
                                roomLikeToResourceKey(room),
                            )
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
                    startAccessor={(segment) => segment.from.toDate()}
                    step={5}
                    style={{ height: "100%" }}
                    timeslots={12}
                    view={currentView}
                    views={{ day: true, week: true, work_week: CustomWorkWeek }}
                />
            </SplitCalendarProvider>
        </ToolbarExtrasContext.Provider>
    );
}
