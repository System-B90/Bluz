import ChatIcon from "@mui/icons-material/Chat";
import FmdBadIcon from "@mui/icons-material/FmdBad";
import LockIcon from "@mui/icons-material/Lock";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";
import TheaterComedyIcon from "@mui/icons-material/TheaterComedy";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import WarningIcon from "@mui/icons-material/Warning";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Dayjs } from "dayjs";
import moment from "moment";
import { useMemo } from "react";

import { useCourses } from "@/components/base/CoursesProvider";
import { useHiveLessons } from "@/components/base/HiveLessonsProvider";
import { useHiveModules } from "@/components/base/HiveModulesProvider";
import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { useRooms } from "@/components/base/RoomsProvider";
import { EventTypeIcon } from "@/components/schedule/event-component/EventTypeIcon";
import {
    Event,
    eventHasLecturers,
    eventHasSubject,
    EventType,
    getPresentInstructors,
} from "@/components/schedule/types/event";

/**
 * Rich tooltip content displayed on long-hover over any event.
 * Shows ALL event information regardless of event size.
 */
export function EventTooltipContent({ event }: { event: Event }) {
    const { getInstructor } = useHiveUsers();
    const { getSubject } = useHiveSubjects();
    const { getModule } = useHiveModules();
    const { getCourse } = useCourses();
    const { getRoom } = useRooms();

    const start = moment((event.startTime as Dayjs).toDate());
    const end = moment((event.endTime as Dayjs).toDate());
    const durationMinutes = useMemo(
        () => Math.max(0, end.diff(start, "minutes")),
        [start, end],
    );
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    const durationLabel =
        hours && minutes
            ? `${hours} ש׳ ${minutes} ד׳`
            : hours
                ? `${hours} ש׳`
                : `${minutes} ד׳`;

    const subject = eventHasSubject(event.type)
        ? getSubject(event.subject)
        : null;
    const { getLesson } = useHiveLessons();
    const hiveModule = event.hiveModule ? getModule(event.hiveModule) : null;
    const hiveLesson = event.hiveLesson ? getLesson(event.hiveLesson) : null;
    const courses = event.courses.map(getCourse).filter((v) => !!v);
    const rooms = event.rooms.map(getRoom).filter((v) => !!v);
    const instructors = getPresentInstructors(event)
        .map(getInstructor)
        .filter((v) => !!v);
    const hasOutsider =
        eventHasLecturers(event.type) &&
        event.lecturers?.includes("איש חוץ");
    const isPrayer = event.type === EventType.PRAYER;
    const isBreak = event.type === EventType.BREAK;

    const statusFlags: Array<{ icon: React.ReactNode; label: string }> = [];
    if (event.locked)
        statusFlags.push({
            icon: <LockIcon fontSize="inherit" />,
            label: "מתואם",
        });
    if (event.required)
        statusFlags.push({
            icon: <FmdBadIcon fontSize="inherit" />,
            label: "קריטי",
        });
    if (event.personalTalk)
        statusFlags.push({
            icon: <ChatIcon fontSize="inherit" />,
            label: 'חלון פ"א',
        });
    if (event.hidden)
        statusFlags.push({
            icon: <VisibilityOffIcon fontSize="inherit" />,
            label: "מוסתר",
        });
    if (event.fake)
        statusFlags.push({
            icon: <TheaterComedyIcon fontSize="inherit" />,
            label: "פיקטיבי",
        });

    return (
        <Box sx={{ p: 0.5, minWidth: 180, maxWidth: 300 }}>
            {/* Header: type icon + name */}
            <Stack alignItems="center" direction="row" gap={0.5} mb={0.5}>
                <EventTypeIcon event={event} sx={{ fontSize: "1rem" }} />
                <Typography fontWeight={700} variant="subtitle2">
                    {event.name}
                </Typography>
            </Stack>

            <Divider sx={{ mb: 0.5, borderColor: "rgba(255,255,255,0.2)" }} />

            {/* Time */}
            <TooltipRow
                icon={<ScheduleIcon fontSize="inherit" />}
                text={`${start.format("HH:mm")} – ${end.format("HH:mm")}  (${durationLabel})`}
            />

            {/* Subject / Module / Lesson */}
            {subject ? (
                <TooltipRow
                    icon={<MenuBookIcon fontSize="inherit" />}
                    text={
                        hiveModule
                            ? `${subject.name} / ${hiveModule.name}${hiveLesson ? ` / ${hiveLesson.name}` : ""}`
                            : subject.name
                    }
                />
            ) : null}

            {/* Courses */}
            {courses.length > 0 && (
                <TooltipRow
                    icon={<MenuBookIcon fontSize="inherit" />}
                    text={courses.map((c) => c.name).join(", ")}
                />
            )}

            {/* Rooms */}
            {rooms.length > 0 ? (
                <TooltipRow
                    icon={<MeetingRoomIcon fontSize="inherit" />}
                    text={rooms.map((r) => r.name).join(", ")}
                />
            ) : !isPrayer && !isBreak ? (
                <TooltipRow
                    icon={<WarningIcon color="error" fontSize="inherit" />}
                    text="אין חדר"
                />
            ) : null}

            {/* Instructors */}
            {instructors.length > 0 || hasOutsider ? (
                <TooltipRow
                    icon={<PersonOutlinedIcon fontSize="inherit" />}
                    text={[
                        ...(hasOutsider ? ["איש חוץ"] : []),
                        ...instructors.map((i) => i.display_name),
                    ].join(", ")}
                />
            ) : !isPrayer ? (
                <TooltipRow
                    icon={<WarningIcon color="error" fontSize="inherit" />}
                    text="אין מבוזרים"
                />
            ) : null}

            {/* Status flags */}
            {statusFlags.length > 0 && (
                <>
                    <Divider
                        sx={{ my: 0.5, borderColor: "rgba(255,255,255,0.2)" }}
                    />
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                        {statusFlags.map(({ icon, label }) => (
                            <Stack
                                alignItems="center"
                                direction="row"
                                gap={0.3}
                                key={label}
                            >
                                {icon}
                                <Typography variant="caption">
                                    {label}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                </>
            )}

            {/* Notes */}
            {event.notes ? (
                <>
                    <Divider
                        sx={{ my: 0.5, borderColor: "rgba(255,255,255,0.2)" }}
                    />
                    <Typography
                        sx={{ opacity: 0.85, whiteSpace: "pre-wrap" }}
                        variant="caption"
                    >
                        {event.notes}
                    </Typography>
                </>
            ) : null}
        </Box>
    );
}

function TooltipRow({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <Stack alignItems="center" direction="row" gap={0.5} mb={0.3}>
            <Box sx={{ fontSize: "0.9rem", display: "flex", opacity: 0.7 }}>
                {icon}
            </Box>
            <Typography variant="caption">{text}</Typography>
        </Stack>
    );
}
