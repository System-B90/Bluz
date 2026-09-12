"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import "dayjs/locale/he";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Views } from "react-big-calendar";

import { apiGetStudentSchedule } from "@/api-client/student-view";
import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
import { StudentEvent } from "@/api-shared/types/student-view";
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
};

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
    const [events, setEvents] = useState<Array<StudentEvent> | null>(null);
    const [failed, setFailed] = useState(false);
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
                    end,
                    room: roomName,
                    start,
                    title: event.name,
                }));
            }),
        [visible],
    );

    const resources = useMemo(
        () =>
            [...new Set(calendarEvents.map((event) => event.room))]
                .sort(sortHe)
                .map((name) => ({ id: name, title: name })),
        [calendarEvents],
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
        return (
            <Box display="flex" justifyContent="center" p={6}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Stack data-testid="student-board" gap={1.5} sx={{ p: 2 }}>
            <Typography component="h1" variant="h5">
                {heading}
            </Typography>

            {courseOptions.length > 0 ? (
                <Box display="flex" flexWrap="wrap" gap={1}>
                    <FilterSelect
                        allLabel="כל הקבוצות"
                        label="קבוצה"
                        onChange={setCourse}
                        options={courseOptions}
                        value={activeCourse}
                    />
                </Box>
            ) : null}

            {events.length === 0 ? (
                <Typography color="text.secondary" variant="body1">
                    אין אירועים ליום זה
                </Typography>
            ) : visible.length === 0 ? (
                <Typography color="text.secondary" variant="body1">
                    אין אירועים התואמים לסינון
                </Typography>
            ) : (
                <Box sx={{ height: "calc(100vh - 180px)" }}>
                    <Calendar
                        components={{ event: CalendarEventContent }}
                        date={day.toDate()}
                        defaultView={Views.DAY}
                        endAccessor="end"
                        eventPropGetter={(event) => ({
                            style: {
                                backgroundColor: (event as CalendarEvent).color,
                                borderColor: (event as CalendarEvent).color,
                            },
                        })}
                        events={calendarEvents}
                        localizer={localizer}
                        resourceAccessor="room"
                        resourceIdAccessor="id"
                        resources={resources}
                        resourceTitleAccessor="title"
                        rtl
                        startAccessor="start"
                        titleAccessor="title"
                        toolbar={false}
                        views={[Views.DAY] as Array<View>}
                    />
                </Box>
            )}
        </Stack>
    );
}

function CalendarEventContent({ event }: { event: CalendarEvent }) {
    return <span>{event.title}</span>;
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
