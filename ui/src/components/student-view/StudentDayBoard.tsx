"use client";

import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import ZoomInMapIcon from "@mui/icons-material/ZoomInMap";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import "dayjs/locale/he";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { View, Views } from "react-big-calendar";

import { apiGetStudentSchedule } from "@/api-client/student-view";
import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
import {
    DEFAULT_CALENDAR_DAY_END_TIME,
    DEFAULT_CALENDAR_DAY_START_TIME,
} from "@/api-shared/types/settings/schedule";
import { StudentEvent } from "@/api-shared/types/student-view";
import { ThemeSelectorIcon } from "@/components/header/ThemeSelector";
import { CalendarSkeleton } from "@/components/schedule/calendar/CalendarSkeleton";
import { createNoOverlapLayout } from "@/components/student-view/no-overlap-layout";
import {
    Calendar,
    localizer,
} from "@/components/student-view/StudentCalendarLocalizer";
import { useForegroundTimer } from "@/components/student-view/use-foreground-timer";
import { useStudentLiveRefresh } from "@/components/student-view/use-student-live-refresh";

/** No-room column, mirrors the staff calendar's own sentinel (#656). */
const NO_ROOM = "ללא כיתה";

type CalendarEvent = {
    room: string;
    title: string;
    start: Date;
    end: Date;
    color: string;
    /** Course ("מסלול") display names, shown on the tile. */
    courses: Array<string>;
};

/** Grid window used until the schedule response carries the real settings. */
const DEFAULT_HOURS = {
    end: DEFAULT_CALENDAR_DAY_END_TIME,
    start: DEFAULT_CALENDAR_DAY_START_TIME,
};

/** Applies an `HH:mm` setting onto the rendered day. */
function applyTime(base: ReturnType<typeof dayjs>, time: string) {
    const [hour, minute] = time.split(":").map(Number);
    return base.hour(hour || 0).minute(minute || 0);
}

/** Matches the staff grid: hours down the gutter, 5-minute snap. */
const CALENDAR_FORMATS = { timeGutterFormat: "HH:mm" };

/** Sentinel for "no filter", so an empty `<TextField select>` value is avoided. */
const ALL = "";

/*
 * Deliberately not imported from `components/base/use-grouped-instructors`:
 * that module pulls in the Courses and Hive users providers, which would drag
 * the staff data layer into the student bundle (#656).
 */
const sortHe = (a: string, b: string) => a.localeCompare(b, "he");

/**
 * The student-facing schedule board (#656).
 *
 * Deliberately self-contained: it mounts none of the calendar's providers,
 * dialogs, context menus or the app bar, so there is no staff surface in the
 * tree for a student to reach — and nothing on screen implies the rest of the
 * app exists. It renders exactly the fields `StudentEvent` carries, and the
 * server guarantees it can carry no others.
 */
export function StudentDayBoard({ date }: { date?: string }) {
    const theme = useTheme();
    const [events, setEvents] = useState<Array<StudentEvent> | null>(null);
    const [failed, setFailed] = useState(false);
    const [hours, setHours] = useState(DEFAULT_HOURS);
    const [fullscreen, setFullscreen] = useState(false);
    // Clicking a room header zooms that column to the full width; clicking it
    // again returns to every room.
    const [zoomedRoom, setZoomedRoom] = useState<null | string>(null);
    const [course, setCourse] = useState(ALL);
    // Bumped by the live-refresh ping to re-run the fetch below.
    const [reloadToken, setReloadToken] = useState(0);

    // Counts time the board is open and focused (#656). Invisible to the
    // student — nothing about it renders.
    useForegroundTimer();

    const onRemoteChange = useCallback(() => setReloadToken((n) => n + 1), []);
    useStudentLiveRefresh(onRemoteChange);

    useEffect(() => {
        if (!fullscreen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setFullscreen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [fullscreen]);

    useEffect(() => {
        // State is only ever touched after the await, so switching days does
        // not cascade a render before the new day has actually loaded.
        let cancelled = false;
        void (async () => {
            try {
                const response = await apiGetStudentSchedule(date);
                if (cancelled) return;
                setEvents(response.events);
                setHours({
                    end: response.calendarDayEndTime || DEFAULT_HOURS.end,
                    start: response.calendarDayStartTime || DEFAULT_HOURS.start,
                });
                setFailed(false);
            } catch {
                if (!cancelled) setFailed(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [date, reloadToken]);

    // Filter options come from the day's own events, so the picker can never
    // name a class or room the student was not already allowed to see — no
    // extra request, and nothing beyond what the projection already carries.
    const courseOptions = useMemo(
        () => collectNames(events, (event) => event.relatedCourses),
        [events],
    );

    // A selection carried over from another day may name something that day
    // has none of. Falling back to "all" keeps the board from silently
    // rendering empty, and keeps the select's value inside its option list.
    const activeCourse = courseOptions.includes(course) ? course : ALL;

    const visible = useMemo(
        () =>
            (events ?? []).filter(
                (event) =>
                    activeCourse === ALL ||
                    event.relatedCourses.includes(activeCourse),
            ),
        [activeCourse, events],
    );

    // One resource column per room; events with no room land in NO_ROOM.
    // Events in more than one room repeat, once per column, same as the
    // staff calendar's own resource view.
    const calendarEvents = useMemo<Array<CalendarEvent>>(
        () =>
            visible.flatMap((event) => {
                const start = dayjs(event.startTime).tz(APP_TIMEZONE).toDate();
                const end = dayjs(event.endTime).tz(APP_TIMEZONE).toDate();
                const rooms = event.rooms.length > 0 ? event.rooms : [NO_ROOM];
                return rooms.map((roomName) => ({
                    color: event.color,
                    courses: event.courses,
                    end,
                    room: roomName,
                    start,
                    title: event.name,
                }));
            }),
        [visible],
    );

    // A day with no events still renders the grid — one placeholder column,
    // so the student sees an empty schedule rather than a bare message.
    const resources = useMemo(() => {
        const names = [...new Set(calendarEvents.map((event) => event.room))].sort(
            sortHe,
        );
        const all = names.length > 0 ? names : [NO_ROOM];
        const shown = zoomedRoom && all.includes(zoomedRoom) ? [zoomedRoom] : all;
        return shown.map((name) => ({ id: name, title: name }));
    }, [calendarEvents, zoomedRoom]);

    const toggleZoom = useCallback(
        (room: string) => setZoomedRoom((current) => (current === room ? null : room)),
        [],
    );

    const components = useMemo(
        () => ({
            event: CalendarEventContent,
            resourceHeader: ({ resource }: { resource: { title: string } }) => (
                <RoomHeader
                    label={resource.title}
                    onToggle={toggleZoom}
                    zoomed={zoomedRoom === resource.title}
                />
            ),
        }),
        [toggleZoom, zoomedRoom],
    );

    // Same grid window as the staff calendar. The bounds ride on the schedule
    // response because the student bundle mounts no settings provider.
    const bounds = useMemo(() => {
        const base = dayjs(date ?? undefined)
            .tz(APP_TIMEZONE)
            .startOf("day");
        const min = applyTime(base, hours.start);
        const max = applyTime(base, hours.end);
        // A midnight end parses before the min, leaving react-big-calendar an
        // inverted range and no slots — read it as the end of the same day.
        return {
            min: min.toDate(),
            max: (max.isAfter(min) ? max : base.endOf("day")).toDate(),
        };
    }, [date, hours]);

    // State, not a ref: the grid mounts only after the first load, and the
    // measuring effect must re-run when it does.
    const [grid, setGrid] = useState<HTMLDivElement | null>(null);
    const minTileMs = useMinTileMs(
        grid,
        bounds.max.getTime() - bounds.min.getTime(),
    );
    const dayLayout = useMemo(
        () => createNoOverlapLayout(minTileMs)<CalendarEvent>,
        [minTileMs],
    );

    const day = dayjs(date ?? undefined)
        .tz(APP_TIMEZONE)
        .locale("he");
    const heading = `יום ${day.format("dddd")}, ${day.format("D")} ב${day.format("MMMM")}`;

    if (failed) {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                לא ניתן לטעון את הלוח כרגע
            </Alert>
        );
    }

    if (!events) {
        // Same skeleton the staff calendar uses, so the first paint reads as
        // the grid arriving rather than a spinner on an empty page.
        return (
            <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>
                <CalendarSkeleton />
            </Box>
        );
    }

    return (
        <Stack
            data-testid="student-board"
            gap={1}
            sx={{
                bgcolor: "background.default",
                color: "text.primary",
                flex: 1,
                minHeight: 0,
                p: 2,
            }}
        >
            <Box alignItems="center" display="flex" flexWrap="wrap" gap={1.5}>
                <Typography component="h1" sx={{ fontWeight: 600 }} variant="h6">
                    {heading}
                </Typography>

                <FilterSelect
                    allLabel="כל השאפלים"
                    label="שאפל"
                    onChange={setCourse}
                    options={courseOptions}
                    value={activeCourse}
                />

                <Box flexGrow={1} />

                <Tooltip title="מסך מלא">
                    <IconButton
                        aria-label="מסך מלא"
                        onClick={() => setFullscreen(true)}
                        size="small"
                    >
                        <FullscreenIcon fontSize="small" />
                    </IconButton>
                </Tooltip>

                <ThemeSelectorIcon />
            </Box>

            <Box
                ref={setGrid}
                sx={
                    fullscreen
                        ? {
                            bgcolor: "background.paper",
                            height: "100vh",
                            insetInlineStart: 0,
                            overflow: "hidden",
                            position: "fixed",
                            top: 0,
                            width: "100vw",
                            zIndex: 9999,
                        }
                        : {
                            bgcolor: "background.paper",
                            border: 1,
                            borderColor: "divider",
                            borderRadius: 1,
                            flex: 1,
                            // Without this a flex child refuses to shrink
                            // below its content, and the grid overflows the
                            // page instead of scrolling inside its own box.
                            minHeight: 0,
                            overflow: "hidden",
                        }
                }
            >
                {fullscreen ? (
                    <Tooltip title="צא ממסך מלא (Esc)">
                        <IconButton
                            aria-label="צא ממסך מלא (Esc)"
                            onClick={() => setFullscreen(false)}
                            size="small"
                            sx={{
                                bgcolor: "background.paper",
                                border: 1,
                                borderColor: "divider",
                                insetInlineEnd: 8,
                                position: "absolute",
                                top: 8,
                                zIndex: 1,
                            }}
                        >
                            <FullscreenExitIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                ) : null}

                <Calendar
                    components={components}
                    date={day.toDate()}
                    // Students must never see tiles stacked over each other:
                    // concurrent events in a room share its width instead.
                    dayLayoutAlgorithm={dayLayout}
                    defaultView={Views.DAY}
                    endAccessor="end"
                    eventPropGetter={(event) => {
                        const color = (event as CalendarEvent).color;
                        return {
                            style: {
                                backgroundColor: color,
                                borderColor: color,
                                // The shared calendar.css paints every tile
                                // with the theme foreground, which is
                                // unreadable on an arbitrary subject hex.
                                color: theme.palette.getContrastText(color),
                            },
                        };
                    }}
                    events={calendarEvents}
                    formats={CALENDAR_FORMATS}
                    localizer={localizer}
                    max={bounds.max}
                    min={bounds.min}
                    resourceAccessor="room"
                    resourceIdAccessor="id"
                    resources={resources}
                    resourceTitleAccessor="title"
                    rtl
                    startAccessor="start"
                    step={15}
                    style={{ height: "100%" }}
                    timeslots={4}
                    titleAccessor="title"
                    toolbar={false}
                    views={[Views.DAY] as Array<View>}
                />
            </Box>
        </Stack>
    );
}

/**
 * A room column header. Clicking it zooms the board to that room alone, and
 * clicking the zoomed header returns every room — the same affordance the
 * staff calendar has for a single-room day, minus anything staff-only.
 */
function RoomHeader({
    label,
    onToggle,
    zoomed,
}: {
    label: string;
    onToggle: (room: string) => void;
    zoomed: boolean;
}) {
    return (
        <Tooltip title={zoomed ? "חזרה לכל הכיתות" : `הצגת ${label} בלבד`}>
            <Box
                aria-pressed={zoomed}
                component="button"
                onClick={() => onToggle(label)}
                sx={{
                    alignItems: "center",
                    background: "none",
                    // A zoomed column is marked by an underline under its own
                    // name rather than a glyph stuck to the text: it reads as
                    // a selected tab, which is what it behaves like.
                    borderBlockEnd: 2,
                    borderBlockEndStyle: "solid",
                    borderColor: zoomed ? "primary.main" : "transparent",
                    borderInline: 0,
                    borderBlockStart: 0,
                    color: "inherit",
                    cursor: "pointer",
                    display: "flex",
                    font: "inherit",
                    fontWeight: zoomed ? 700 : "inherit",
                    gap: 0.5,
                    justifyContent: "center",
                    px: 0.5,
                    py: 0.25,
                    transition: "border-color 0.15s ease-in-out",
                    width: "100%",
                    "&:hover": {
                        borderColor: zoomed ? "primary.main" : "divider",
                    },
                }}
                type="button"
            >
                {label}
                {zoomed ? (
                    <ZoomInMapIcon sx={{ fontSize: "0.9rem", opacity: 0.7 }} />
                ) : null}
            </Box>
        </Tooltip>
    );
}

/** `.rbc-day-slot .rbc-event { min-height }` in the calendar stylesheets. */
const MIN_TILE_PX = 20;

/**
 * How much time the grid's minimum tile height covers, rounded up to a whole
 * minute so small resizes do not re-run the layout. A short event is drawn
 * that tall, so the layout must reserve that much time for it or the next
 * event is drawn over its tail. 0 until the grid can be measured.
 */
function useMinTileMs(
    grid: HTMLDivElement | null,
    spanMs: number,
): number {
    const [slotHeight, setSlotHeight] = useState(0);

    useLayoutEffect(() => {
        if (!grid || typeof ResizeObserver === "undefined") return;
        const measure = () =>
            setSlotHeight(
                grid.querySelector<HTMLElement>(".rbc-day-slot")?.clientHeight ??
                    0,
            );
        const observer = new ResizeObserver(measure);
        observer.observe(grid);
        measure();
        return () => observer.disconnect();
    }, [grid]);

    if (slotHeight <= 0 || spanMs <= 0) return 0;
    return Math.ceil((MIN_TILE_PX / slotHeight) * spanMs / 60_000) * 60_000;
}

/**
 * Measured tile heights (px) at which each line still fits. Measured, not
 * derived from the event's duration: the grid's pixels-per-minute depends on
 * the day window and the viewport, so a minute threshold clips on short days.
 */
const COMPACT_HEIGHT = 26;
const COURSES_HEIGHT = 34;

/**
 * The height of the tile this content sits in. Measured on the *parent*
 * (`.rbc-event`, sized by the grid) rather than on the content itself: an
 * observer on the content feeds its own layout, and the tile flickers between
 * the one- and two-line forms.
 */
function useTileHeight() {
    const ref = useRef<HTMLDivElement | null>(null);
    const [height, setHeight] = useState(0);

    useLayoutEffect(() => {
        const tile = ref.current?.parentElement;
        // No observer under jsdom/SSR: the tile then keeps its full form,
        // which is the right default for anything that cannot measure.
        if (!tile || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(([entry]) =>
            setHeight(entry.contentRect.height),
        );
        observer.observe(tile);
        return () => observer.disconnect();
    }, []);

    return { height, ref };
}

function CalendarEventContent({ event }: { event: CalendarEvent }) {
    const { height: tileHeight, ref } = useTileHeight();
    const start = dayjs(event.start).tz(APP_TIMEZONE);
    const end = dayjs(event.end).tz(APP_TIMEZONE);
    const range = `${start.format("HH:mm")}–${end.format("HH:mm")}`;
    const courses = event.courses.join(" • ");
    // Until the observer reports, assume there is room: a first paint with
    // both lines that then collapses reads better than the reverse.
    const height = tileHeight || COURSES_HEIGHT;
    const compact = height < COMPACT_HEIGHT;
    const showCourses = Boolean(courses) && height >= COURSES_HEIGHT;

    const clipped = {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    } as const;

    return (
        // `dir` as an attribute, not a style: the emotion RTL plugin flips a
        // `direction` declaration in `sx`, so styling it there yields LTR.
        <Box
            dir="rtl"
            ref={ref}
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.15,
                height: "100%",
                overflow: "hidden",
                px: 0.75,
                py: compact ? 0 : 0.25,
                textAlign: "start",
            }}
        >
            {/* Name and time share the first row — the time sits at its far
                end — so a short tile spends its height on the courses line
                instead of a row of its own. */}
            <Box
                sx={{
                    alignItems: "baseline",
                    display: "flex",
                    gap: 0.75,
                    minWidth: 0,
                }}
            >
                <Typography
                    sx={{
                        fontSize: compact ? "0.6875rem" : "0.75rem",
                        fontWeight: 700,
                        lineHeight: compact ? 1.1 : 1.2,
                        ...clipped,
                    }}
                >
                    {event.title}
                </Typography>
                <Box flexGrow={1} />
                <Typography
                    sx={{
                        flexShrink: 0,
                        fontSize: compact ? "0.625rem" : "0.6875rem",
                        lineHeight: compact ? 1.1 : 1.2,
                        opacity: 0.85,
                    }}
                >
                    {/* `bdi` keeps the range itself LTR without dragging the
                        line's own alignment out of the RTL tile. */}
                    <bdi dir="ltr">{range}</bdi>
                </Typography>
            </Box>

            {showCourses ? (
                <Typography
                    sx={{
                        fontSize: "0.6875rem",
                        lineHeight: 1.2,
                        opacity: 0.85,
                        textAlign: "start",
                        ...clipped,
                    }}
                >
                    {courses}
                </Typography>
            ) : null}
        </Box>
    );
}

/** Distinct, Hebrew-sorted names pulled off the day's events. */
function collectNames(
    events: Array<StudentEvent> | null,
    pick: (event: StudentEvent) => Array<string>,
): Array<string> {
    return [...new Set((events ?? []).flatMap(pick))].sort(sortHe);
}

function FilterSelect({
    allLabel,
    label,
    onChange,
    options,
    value,
}: {
    allLabel: string;
    label: string;
    onChange: (next: string) => void;
    options: Array<string>;
    value: string;
}) {
    if (options.length === 0) return null;

    return (
        <TextField
            label={label}
            onChange={(e) => onChange(e.target.value)}
            select
            size="small"
            sx={{ minWidth: 160 }}
            value={value}
        >
            <MenuItem value={ALL}>{allLabel}</MenuItem>
            {options.map((option) => (
                <MenuItem key={option} value={option}>
                    {option}
                </MenuItem>
            ))}
        </TextField>
    );
}
