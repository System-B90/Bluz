import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import React from "react";

import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { ContainerSize } from "@/components/schedule/event-component/base";
import { EventDurationLabel } from "@/components/schedule/event-component/EventDurationLabel";
import { EventStatusIcons } from "@/components/schedule/event-component/EventStatusIcons";
import { EventTypeIcon } from "@/components/schedule/event-component/EventTypeIcon";
import { CourseComponent } from "@/components/schedule/event-component/parts/course";
import { InstructorsList } from "@/components/schedule/event-component/parts/person";
import { RoomComponent } from "@/components/schedule/event-component/parts/room";
import {
    LessonComponent,
    ModuleComponent,
    SubjectComponent,
} from "@/components/schedule/event-component/parts/subject";
import {
    Event,
    EventType,
    getPresentInstructors,
} from "@/components/schedule/types/event";

/* ── Detail-level thresholds (px) ───────────────────────────── */
const DETAIL = {
    /** Below: name + instructor only */
    MINIMAL: 30,
    /** Below: name + instructor + duration */
    COMPACT: 70,
    /** Below: + room + course rows */
    STANDARD: 140,
    /* Above STANDARD → full: + subject/module + notes */
};
const NARROW_WIDTH = 200;

type DetailLevel = "compact" | "full" | "minimal" | "standard";
function getDetailLevel(h: number): DetailLevel {
    if (h < DETAIL.MINIMAL) return "minimal";
    if (h < DETAIL.COMPACT) return "compact";
    if (h < DETAIL.STANDARD) return "standard";
    return "full";
}

/* ── Thin accent divider ────────────────────────────────────── */
function AccentDivider() {
    return (
        <Box
            sx={{
                height: "1px",
                width: "100%",
                background:
                    "linear-gradient(90deg, transparent 0%, var(--event-divider) 20%, var(--event-divider) 80%, transparent 100%)",
                my: 0.35,
                flexShrink: 0,
            }}
        />
    );
}

/* ═══════════════════════════════════════════════════════════════
   Unified Event
   ═══════════════════════════════════════════════════════════════ */
export function UnifiedEvent({
    event,
    size,
}: {
    event: Event;
    size: ContainerSize;
}) {
    const { showMisconfigurations } = useCalendarFilters();
    const detail = getDetailLevel(size.height);
    const isNarrow = size.width < NARROW_WIDTH;
    const isPrayer = event.type === EventType.PRAYER;
    const isBreak = event.type === EventType.BREAK;

    /* ── MINIMAL ─────────────────────────────────────────────── */
    if (detail === "minimal") {
        return (
            <Box
                alignItems="center"
                display="flex"
                gap={0.5}
                height="100%"
                overflow="hidden"
                px={0.4}
            >
                <Typography
                    noWrap
                    sx={{ fontWeight: 700, lineHeight: 1.2 }}
                    variant="caption"
                >
                    {event.name}
                </Typography>
                {/* Instructor name is the 2nd-most important element — always visible */}
                {!isPrayer &&
                (getPresentInstructors(event).length > 0 ||
                    showMisconfigurations) ? (
                        <>
                            <Box
                                sx={{
                                    width: "1px",
                                    height: "60%",
                                    bgcolor: "var(--event-border)",
                                    flexShrink: 0,
                                }}
                            />
                            <InstructorsList
                                event={event}
                                showCaption={false}
                                sx={{
                                    flexShrink: 1,
                                    minWidth: 0,
                                    overflow: "hidden",
                                }}
                            />
                        </>
                    ) : null}
            </Box>
        );
    }

    /* ── COMPACT ──────────────────────────────────────────────── */
    if (detail === "compact") {
        const hasInstructors =
            !isPrayer &&
            (getPresentInstructors(event).length > 0 || showMisconfigurations);
        const hasRooms =
            !isPrayer &&
            size.height >= 55 &&
            !isBreak &&
            (event.rooms.length > 0 || showMisconfigurations);
        const showSecondRow = hasInstructors || hasRooms;

        return (
            <Box
                display="flex"
                flexDirection="column"
                height="100%"
                justifyContent="center"
                overflow="hidden"
                px={0.4}
                py={0.2}
            >
                {/* Row 1: name | duration + status */}
                <Box
                    alignItems="center"
                    display="flex"
                    justifyContent="space-between"
                >
                    <Box
                        alignItems="center"
                        display="flex"
                        gap={0.3}
                        minWidth={0}
                    >
                        {!isNarrow && (
                            <EventTypeIcon
                                event={event}
                                sx={{ fontSize: "0.85rem" }}
                            />
                        )}
                        <Typography
                            noWrap
                            sx={{ fontWeight: 700, lineHeight: 1.2 }}
                            variant="subtitle2"
                        >
                            {event.name}
                        </Typography>
                    </Box>
                    <Box
                        alignItems="center"
                        display="flex"
                        flexShrink={0}
                        gap={0.3}
                    >
                        <EventDurationLabel event={event} variant="text" />
                        <EventStatusIcons event={event} size="0.75rem" />
                    </Box>
                </Box>

                {/* Row 2: instructors (always) + room if space */}
                {showSecondRow ? (
                    <>
                        <AccentDivider />
                        <Box
                            alignItems="center"
                            display="flex"
                            gap={0.6}
                            overflow="hidden"
                        >
                            {hasInstructors ? (
                                <InstructorsList
                                    event={event}
                                    showCaption={false}
                                />
                            ) : null}
                            {hasInstructors && hasRooms ? (
                                <Box
                                    sx={{
                                        width: "1px",
                                        alignSelf: "stretch",
                                        bgcolor: "var(--event-divider)",
                                        flexShrink: 0,
                                    }}
                                />
                            ) : null}
                            {hasRooms ? (
                                <RoomComponent
                                    roomIds={event.rooms}
                                    showCaption={false}
                                />
                            ) : null}
                        </Box>
                    </>
                ) : null}
            </Box>
        );
    }

    /* ── STANDARD & FULL ─────────────────────────────────────── */
    const showSubject = detail === "full" && !isBreak && !isPrayer;
    const showNotes = detail === "full" && !!event.notes;
    const showCaptions = detail === "full";

    const rows: Array<React.ReactNode> = [];

    if (
        !isPrayer &&
        (getPresentInstructors(event).length > 0 || showMisconfigurations)
    ) {
        rows.push(
            <InstructorsList
                event={event}
                key="instructors"
                showCaption={showCaptions}
            />,
        );
    }

    if (
        !isPrayer &&
        !isBreak &&
        (event.rooms.length > 0 || showMisconfigurations)
    ) {
        rows.push(
            <RoomComponent
                key="rooms"
                roomIds={event.rooms}
                showCaption={showCaptions}
            />,
        );
    }

    if (!isPrayer && !isBreak && event.courses.length > 0) {
        rows.push(
            <CourseComponent
                courseIds={event.courses}
                key="courses"
                showCaption={showCaptions}
            />,
        );
    }

    if (showSubject) {
        rows.push(
            <Box
                alignItems="baseline"
                display="flex"
                flexDirection="row"
                gap={0.3}
                key="subject"
            >
                <SubjectComponent
                    fontSize="0.75rem"
                    fontWeight={500}
                    subjectId={event.subject}
                />
                {event.hiveModule ? (
                    <>
                        <Typography fontSize="0.75rem" fontWeight={300}>
                            /
                        </Typography>
                        <ModuleComponent
                            fontSize="0.75rem"
                            fontWeight={400}
                            moduleId={event.hiveModule}
                        />
                        {event.hiveLesson ? (
                            <>
                                <Typography fontSize="0.75rem" fontWeight={300}>
                                    /
                                </Typography>
                                <LessonComponent
                                    fontSize="0.75rem"
                                    fontWeight={400}
                                    lessonId={event.hiveLesson}
                                />
                            </>
                        ) : null}
                    </>
                ) : null}
            </Box>,
        );
    }

    if (showNotes) {
        rows.push(
            <Typography
                key="notes"
                noWrap
                sx={{ opacity: 0.75, fontStyle: "italic" }}
                variant="caption"
            >
                {event.notes}
            </Typography>,
        );
    }

    return (
        <Box
            display="flex"
            flexDirection="column"
            height="100%"
            overflow="hidden"
            p={0.5}
        >
            {/* ── Header: icon + name | duration ─────────────── */}
            <Box
                alignItems="center"
                display="flex"
                justifyContent="space-between"
            >
                <Box alignItems="center" display="flex" gap={0.3} minWidth={0}>
                    {!isNarrow && (
                        <EventTypeIcon
                            event={event}
                            sx={{ fontSize: "0.9rem" }}
                        />
                    )}
                    <Typography
                        noWrap
                        sx={{ fontWeight: 700, lineHeight: 1.3 }}
                        variant="subtitle2"
                    >
                        {event.name}
                    </Typography>
                </Box>
                <EventDurationLabel
                    event={event}
                    variant={isNarrow ? "text" : "chip"}
                    {...(isNarrow ? {} : { size: "small" as const })}
                />
            </Box>

            {rows.length > 0 && <AccentDivider />}

            {rows.map((row, idx) => {
                const rowKey = React.isValidElement(row)
                    ? (row.key ?? idx)
                    : idx;
                return (
                    <React.Fragment key={rowKey}>
                        {idx > 0 && <AccentDivider />}
                        {row}
                    </React.Fragment>
                );
            })}

            {/* ── Status icons (bottom-right) ─────────────────── */}
            <EventStatusIcons
                event={event}
                size={detail === "standard" ? "0.9rem" : "1.1rem"}
                sx={{
                    position: "absolute",
                    bottom: 3,
                    insetInlineEnd: 3,
                }}
            />
        </Box>
    );
}
