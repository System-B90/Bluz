"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import "dayjs/locale/he";
import { useCallback, useEffect, useMemo, useState } from "react";
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
    const [course, setCourse] = useState(ALL);
    // Bumped by the live-refresh ping to re-run the fetch below.
    const [reloadToken, setReloadToken] = useState(0);

    // Counts time the board is open and focused (#656). Invisible to the
    // student — nothing about it renders.
    useForegroundTimer();

    const onRemoteChange = useCallback(() => setReloadToken((n) => n + 1), []);
    useStudentLiveRefresh(onRemoteChange);

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
                    end: response.calendarDayEndTime,
                    start: response.calendarDayStartTime,
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
        () => collectNames(events, (event) => event.courses),
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
                    activeCourse === ALL || event.courses.includes(activeCourse),
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
        return (names.length > 0 ? names : [NO_ROOM]).map((name) => ({
            id: name,
            title: name,
        }));
    }, [calendarEvents]);

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
            <Box sx={{ height: "calc(100vh - 120px)", position: "relative" }}>
                <CalendarSkeleton />
            </Box>
        );
    }

    return (
        <Stack
            data-testid="student-board"
            gap={1}
            sx={{ bgcolor: "background.default", color: "text.primary", p: 2 }}
        >
            <Box alignItems="center" display="flex" flexWrap="wrap" gap={1.5}>
                <Typography component="h1" sx={{ fontWeight: 600 }} variant="h6">
                    {heading}
                </Typography>

                <FilterSelect
                    allLabel="כל הקבוצות"
                    label="קבוצה"
                    onChange={setCourse}
                    options={courseOptions}
                    value={activeCourse}
                />

                <Box flexGrow={1} />
                <ThemeSelectorIcon />
            </Box>

            <Box
                sx={{
                    bgcolor: "background.paper",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    height: "calc(100vh - 140px)",
                    overflow: "hidden",
                }}
            >
                <Calendar
                    components={{ event: CalendarEventContent }}
                    date={day.toDate()}
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

function CalendarEventContent({ event }: { event: CalendarEvent }) {
    const range = `${dayjs(event.start).tz(APP_TIMEZONE).format("HH:mm")}–${dayjs(
        event.end,
    )
        .tz(APP_TIMEZONE)
        .format("HH:mm")}`;

    return (
        // `dir` as an attribute, not a style: the emotion RTL plugin flips a
        // `direction` declaration in `sx`, so styling it there yields LTR.
        <Box
            dir="rtl"
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.25,
                height: "100%",
                justifyContent: "flex-start",
                overflow: "hidden",
                px: 0.75,
                py: 0.25,
                textAlign: "start",
            }}
        >
            <Typography
                sx={{
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    lineHeight: 1.25,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
                {event.title}
            </Typography>
            <Typography
                sx={{
                    fontSize: "0.6875rem",
                    lineHeight: 1.2,
                    opacity: 0.85,
                    textAlign: "start",
                    whiteSpace: "nowrap",
                }}
            >
                {/* `bdi` keeps the range itself LTR without dragging the
                    line's own alignment out of the RTL tile. */}
                <bdi dir="ltr">{range}</bdi>
            </Typography>
            {event.courses.length > 0 ? (
                <Typography
                    sx={{
                        fontSize: "0.6875rem",
                        lineHeight: 1.2,
                        opacity: 0.85,
                        overflow: "hidden",
                        textAlign: "start",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {event.courses.join(" • ")}
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
