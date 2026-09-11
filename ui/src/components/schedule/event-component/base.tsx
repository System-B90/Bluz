import LockPersonIcon from "@mui/icons-material/LockPerson";
import Box from "@mui/material/Box";
import { alpha, Theme, useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import { MouseEvent as ReactMouseEvent, useCallback, useMemo } from "react";
import { EventProps } from "react-big-calendar";

import { breakWindowsFor, workingMsOf } from "@/api-shared/break-windows";
import {
    Interval,
    layoutAroundWindows,
    layoutEnd,
    MIN_SEGMENT_MINUTES,
    workingMsUpTo,
} from "@/api-shared/interval-layout";
import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { useCustomColors } from "@/components/base/CustomColorsProvider";
import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";
import { dampDragDelta } from "@/components/schedule/calendar/calendar/UsePrecisionDrag";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import { useEventDropTarget } from "@/components/schedule/calendar/instructor-dnd/use-event-drop-target";
import {
    asDragPreview,
    EventSegment,
    isFirstSegment,
    isLastSegment,
    SegmentDragPreview,
} from "@/components/schedule/calendar/split/segments";
import { useSplitCalendar } from "@/components/schedule/calendar/split/SplitCalendarContext";
import { resolveEventColor } from "@/components/schedule/event-component/event-colors";
import { EventTooltipContent } from "@/components/schedule/event-component/EventTooltip";
import { UnifiedEvent } from "@/components/schedule/event-component/UnifiedEvent";
import { useElementSize } from "@/components/schedule/event-component/utils";
import { Event } from "@/components/schedule/types/event";

export type ContainerSize = {
    width: number;
    height: number;
};

/** Below this height a continuation piece stays bare colour — no room for text. */
const CONTINUATION_LABEL_MIN_HEIGHT = 34;

const CORNER_RADIUS = "4px";
const MIN_WORKING_MS = MIN_SEGMENT_MINUTES * 60_000;

/** Mouse button index of the wheel/middle button in `MouseEvent.button`. */
const MIDDLE_BUTTON = 1;

/**
 * The instant under the pointer, snapped to the grid step. A piece never
 * crosses a break, so its on-screen height maps linearly onto its own
 * `from..to` span.
 */
function instantUnderPointer(
    segment: EventSegment,
    pointer: ReactMouseEvent<HTMLElement>,
): number {
    const rect = pointer.currentTarget.getBoundingClientRect();
    const ratio =
        rect.height > 0
            ? Math.min(1, Math.max(0, (pointer.clientY - rect.top) / rect.height))
            : 0;
    const from = segment.from.valueOf();
    const raw = from + ratio * (segment.to.valueOf() - from);
    return Math.round(raw / MIN_WORKING_MS) * MIN_WORKING_MS;
}

/**
 * Corner rounding that makes a run of pieces read as one object: only the
 * outer ends of the run are rounded, the cut edges stay square. Logical
 * properties keep this correct under the RTL grid.
 */
function runCornerSx(isFirst: boolean, isLast: boolean) {
    return {
        borderStartStartRadius: isFirst ? CORNER_RADIUS : 0,
        borderStartEndRadius: isFirst ? CORNER_RADIUS : 0,
        borderEndStartRadius: isLast ? CORNER_RADIUS : 0,
        borderEndEndRadius: isLast ? CORNER_RADIUS : 0,
    };
}

/**
 * A hairline rule just inside each cut edge — the visual "the event continues
 * on the other side of the break" cue. Scales to any number of breaks without
 * adding chrome, and costs no extra DOM.
 */
function cutEdgeSx(accent: string, isFirst: boolean, isLast: boolean) {
    const rule = {
        content: '""',
        position: "absolute" as const,
        insetInlineStart: 4,
        insetInlineEnd: 4,
        height: "2px",
        borderRadius: "2px",
        background: `linear-gradient(90deg, transparent 0%, ${alpha(accent, 0.5)} 20%, ${alpha(accent, 0.5)} 80%, transparent 100%)`,
        pointerEvents: "none" as const,
    };

    return {
        ...(isFirst ? {} : { "&::before": { ...rule, top: "2px" } }),
        ...(isLast ? {} : { "&::after": { ...rule, bottom: "2px" } }),
    };
}

/** Selection ring drawn only around the run's outer edges, never across a cut. */
function selectionRingSx(theme: Theme, isFirst: boolean, isLast: boolean) {
    const ring = `2px solid ${theme.palette.primary.main}`;
    return {
        borderInlineStart: ring,
        borderInlineEnd: ring,
        borderBlockStart: isFirst ? ring : "none",
        borderBlockEnd: isLast ? ring : "none",
    };
}

/**
 * react-big-calendar's `components.event`. The grid feeds it segments — one
 * box per drawn piece of an event — and it renders either a real grid piece or
 * the live drag preview of the whole event.
 */
export function BluzEventComponent(props: EventProps<EventSegment>) {
    return (
        <ErrorBoundary fallback={<BrokenEventTile />} scope="event-tile">
            <BluzEventComponentInner {...props} />
        </ErrorBoundary>
    );
}

/** Degraded placeholder so one bad tile cannot take the whole grid down. */
function BrokenEventTile() {
    return (
        <Box
            alignItems="center"
            bgcolor="action.disabledBackground"
            border="1px dashed"
            borderColor="error.main"
            display="flex"
            height="100%"
            justifyContent="center"
            overflow="hidden"
            sx={{ borderRadius: CORNER_RADIUS }}
            width="100%"
        >
            <Typography color="error" fontSize={10} noWrap>
                שגיאה בהצגת האירוע
            </Typography>
        </Box>
    );
}

function BluzEventComponentInner({ event: segment }: EventProps<EventSegment>) {
    const preview = asDragPreview(segment);
    return preview ? (
        <SplitDragPreview preview={preview} />
    ) : (
        <EventSegmentBlock segment={segment} />
    );
}

/* ═══════════════════════════════════════════════════════════════
   One drawn piece of an event
   ═══════════════════════════════════════════════════════════════ */
function EventSegmentBlock({ segment }: { segment: EventSegment }) {
    const { event } = segment;
    const theme = useTheme();
    const { getSubject } = useHiveSubjects();
    const { getCustomColor } = useCustomColors();
    const { eventFilteredOpacity } = useCalendarFilters();
    const { eventLocks } = useCalendar();
    const {
        hoveredEventId,
        selectedEventId,
        activeDrag,
        setHoveredEventId,
        splitEventAt,
    } = useSplitCalendar();

    const isFirst = isFirstSegment(segment);
    const isLast = isLastSegment(segment);
    // Every piece of the event reacts to a pointer on any one of them, which
    // is what sells them as a single object rather than N neighbours.
    const isHovered = hoveredEventId === event.id;
    const isSelected = selectedEventId === event.id;
    const isBeingDragged = activeDrag?.eventId === event.id;
    // A Ctrl+drag leaves the original where it is, so it must not fade like
    // a moved one — the fade is the "this is leaving" cue.
    const isFading = isBeingDragged && !activeDrag?.duplicate;

    // Split gestures (#657): Shift+click, or a middle-click for devices with
    // a wheel button. Both stop here so the grid does not also treat them as
    // a select. The middle button's mousedown is cancelled too, or Chrome
    // starts its autoscroll mode on the same press.
    const splitHere = useCallback(
        (pointer: ReactMouseEvent<HTMLElement>) => {
            pointer.preventDefault();
            pointer.stopPropagation();
            if (event.locked) return;
            splitEventAt(event, instantUnderPointer(segment, pointer));
        },
        [ event, segment, splitEventAt ],
    );
    const handleClick = useCallback(
        (pointer: ReactMouseEvent<HTMLElement>) => {
            if (pointer.shiftKey) splitHere(pointer);
        },
        [ splitHere ],
    );
    const handleAuxClick = useCallback(
        (pointer: ReactMouseEvent<HTMLElement>) => {
            if (pointer.button === MIDDLE_BUTTON) splitHere(pointer);
        },
        [ splitHere ],
    );
    const handleMouseDown = useCallback(
        (pointer: ReactMouseEvent<HTMLElement>) => {
            if (pointer.button === MIDDLE_BUTTON) pointer.preventDefault();
        },
        [],
    );

    const lock = eventLocks[event.id];
    const subject = getSubject(event.subject);
    const bgColor = resolveEventColor(
        event,
        subject,
        { getCustomColor, getSubject },
        theme.palette.common.black,
    );
    const textColor = theme.palette.getContrastText(bgColor);

    const { ref, size } = useElementSize<HTMLDivElement>();

    const filterOpacity = useMemo(
        () => eventFilteredOpacity(event),
        [event, eventFilteredOpacity],
    );

    // Each piece is its own droppable so an instructor can be dropped onto
    // whichever one the pointer is over; they all carry the same event.
    const { setDropRef, isDropTarget, isOver } = useEventDropTarget(
        event,
        !isBeingDragged,
        segment.key,
    );

    return (
        <Box
            onAuxClick={handleAuxClick}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onMouseEnter={() => setHoveredEventId(event.id)}
            onMouseLeave={() => setHoveredEventId(null)}
            ref={setDropRef}
            sx={{
                position: "relative",
                height: "100%",
                opacity: isFading ? 0.35 : 1,
                ...(isOver && {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: "-2px",
                    borderRadius: CORNER_RADIUS,
                }),
                ...(isDropTarget && !isOver && { opacity: 0.85 }),
            }}
        >
            <Tooltip
                arrow
                enterDelay={800}
                enterNextDelay={500}
                placement="top"
                title={<EventTooltipContent event={event} />}
            >
                <Box
                    data-filtered-out={filterOpacity}
                    ref={ref}
                    sx={{
                        textAlign: "start",
                        p: 0.2,
                        bgcolor: isHovered ? alpha(bgColor, 0.9) : bgColor,
                        color: textColor,
                        transition: theme.transitions.create([
                            "background-color",
                            "transform",
                            "opacity",
                        ]),
                        height: "100%",
                        boxSizing: "border-box",
                        position: "relative",
                        overflow: "hidden",
                        opacity: filterOpacity,
                        ...runCornerSx(isFirst, isLast),
                        ...cutEdgeSx(textColor, isFirst, isLast),
                        ...(isSelected && selectionRingSx(theme, isFirst, isLast)),
                        /* Fake (פיקטיבי) events read as placeholders for
                       Checkers/Segel: dashed outline + reduced opacity (#102). */
                        ...(event.fake && {
                            border: `2px dashed ${alpha(textColor, 0.65)}`,
                            opacity: filterOpacity * 0.75,
                        }),
                        /* Contrast-aware accent tokens for child components */
                        "--event-border": alpha(textColor, 0.25),
                        "--event-divider": alpha(textColor, 0.18),
                        "--event-subtle-bg": alpha(textColor, 0.1),
                        "--event-emphasis-bg": alpha(textColor, 0.15),
                    }}
                >
                    {isFirst ? (
                        <UnifiedEvent event={event} size={size} />
                    ) : (
                        <ContinuationLabel event={event} height={size.height} />
                    )}

                    {isFirst && event.fake ? (
                        <Box
                            sx={{
                                position: "absolute",
                                bottom: 2,
                                insetInlineEnd: 4,
                                fontSize: "0.6rem",
                                fontWeight: 700,
                                letterSpacing: "0.03em",
                                color: alpha(textColor, 0.75),
                                pointerEvents: "none",
                            }}
                        >
                        פיקטיבי
                        </Box>
                    ) : null}

                    {isFirst && lock ? <EditingLockBadge name={lock.lockedByName} /> : null}
                </Box>
            </Tooltip>
        </Box>
    );
}

/**
 * What a piece past a break shows: the event's name, dimmed and marked as a
 * continuation — but only when the piece is tall enough to read. Shorter
 * pieces stay bare colour so they don't turn into a smear of clipped text.
 */
function ContinuationLabel({ event, height }: { event: Event; height: number }) {
    if (height < CONTINUATION_LABEL_MIN_HEIGHT) return null;

    return (
        <Box
            alignItems="center"
            display="flex"
            gap={0.4}
            height="100%"
            overflow="hidden"
            px={0.4}
        >
            <Typography
                noWrap
                sx={{ fontWeight: 600, opacity: 0.75, lineHeight: 1.2 }}
                variant="caption"
            >
                {event.name}
            </Typography>
            <Typography
                noWrap
                sx={{ opacity: 0.55, flexShrink: 0 }}
                variant="caption"
            >
                (המשך)
            </Typography>
        </Box>
    );
}

function EditingLockBadge({ name }: { name: string }) {
    const theme = useTheme();

    return (
        <Tooltip arrow placement="top" title={`נערך כעת ע"י ${name}`}>
            <Box
                sx={{
                    position: "absolute",
                    top: 2,
                    insetInlineStart: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    bgcolor: alpha(theme.palette.warning.main, 0.92),
                    color: theme.palette.warning.contrastText,
                    p: 0.15,
                    lineHeight: 0,
                    cursor: "default",
                    transformOrigin: "center",
                    /* Pop in on appearance, then breathe a soft ring
                   to signal that someone is actively editing. */
                    animation:
                    "lock-badge-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), lock-badge-pulse 2.6s ease-in-out 0.22s infinite",
                    "@keyframes lock-badge-in": {
                        from: { transform: "scale(0)", opacity: 0 },
                        to: { transform: "scale(1)", opacity: 1 },
                    },
                    "@keyframes lock-badge-pulse": {
                        "0%, 100%": {
                            boxShadow: `0 0 0 0 ${alpha(theme.palette.warning.main, 0.5)}`,
                        },
                        "50%": {
                            boxShadow: `0 0 0 4px ${alpha(theme.palette.warning.main, 0)}`,
                        },
                    },
                    "@media (prefers-reduced-motion: reduce)": {
                        animation: "none",
                    },
                    transition: "transform 0.15s ease-in-out",
                    "&:hover": { transform: "scale(1.15)" },
                }}
            >
                <LockPersonIcon sx={{ fontSize: "0.85rem" }} />
            </Box>
        </Tooltip>
    );
}

/* ═══════════════════════════════════════════════════════════════
   Live drag preview
   ═══════════════════════════════════════════════════════════════ */

/**
 * Where the whole event would land, given the proposed range of the one piece
 * the user actually grabbed. A move shifts the event by the same delta and
 * keeps its duration; a resize re-measures the duration in working time. An
 * Alt-held (precise) drag damps the pointer's delta first. Kept identical to
 * what `CalendarView` commits on drop, so the preview never lies.
 */
function proposedLayout(
    preview: SegmentDragPreview,
    windows: Array<Interval>,
    action: "move" | "resize",
    direction: string | undefined,
    precise: boolean,
): Array<Interval> {
    const { event } = preview;
    const previewStart = preview.start.valueOf();
    const pieceStart = preview.from.valueOf();
    const eventStart = event.startTime.valueOf();

    if (action === "move") {
        const delta = dampDragDelta(previewStart - pieceStart, precise);
        return layoutAroundWindows(eventStart + delta, workingMsOf(event), windows);
    }

    if (direction === "UP") {
        const displayEnd = layoutEnd(
            layoutAroundWindows(eventStart, workingMsOf(event), windows),
        );
        const newStart =
            pieceStart + dampDragDelta(previewStart - pieceStart, precise);
        const working = Math.max(
            MIN_WORKING_MS,
            workingMsUpTo(newStart, displayEnd, windows),
        );
        return layoutAroundWindows(newStart, working, windows);
    }

    const pieceEnd = preview.to.valueOf();
    const newEnd =
        pieceEnd + dampDragDelta(preview.end.valueOf() - pieceEnd, precise);
    const working = Math.max(
        MIN_WORKING_MS,
        workingMsUpTo(eventStart, newEnd, windows),
    );
    return layoutAroundWindows(eventStart, working, windows);
}

/** What the preview says about the modifier modes currently armed. */
function dragModeLabel(drag: { duplicate: boolean; precise: boolean } | null): string {
    return [ drag?.duplicate && "שכפול", drag?.precise && "דיוק" ]
        .filter(Boolean)
        .join(" · ");
}

/**
 * The dragged event, drawn split exactly as it will look once dropped —
 * including every break it would step over at the new position.
 *
 * react-big-calendar only ever previews the single piece being dragged, and
 * positions that box for us. We use it purely as a ruler: its height spans the
 * proposed range of that piece, so every other piece of the event can be
 * placed against it in percentages, with no access to the grid's internals.
 */
function SplitDragPreview({ preview }: { preview: SegmentDragPreview }) {
    const { event } = preview;
    const theme = useTheme();
    const { getSubject } = useHiveSubjects();
    const { getCustomColor } = useCustomColors();
    const { breakWindows, activeDrag } = useSplitCalendar();

    const bgColor = resolveEventColor(
        event,
        getSubject(event.subject),
        { getCustomColor, getSubject },
        theme.palette.common.black,
    );

    const previewStart = preview.start.valueOf();
    const previewSpan = Math.max(1, preview.end.valueOf() - previewStart);

    const pieces = useMemo(
        () =>
            proposedLayout(
                preview,
                breakWindowsFor(event, breakWindows),
                activeDrag?.action ?? "move",
                activeDrag?.direction,
                activeDrag?.precise ?? false,
            ),
        [preview, event, breakWindows, activeDrag],
    );

    const percentOf = (ms: number) => ((ms - previewStart) / previewSpan) * 100;
    const startLabel = dayjs(pieces[0].start).format("HH:mm");
    const endLabel = dayjs(layoutEnd(pieces)).format("HH:mm");
    const showEndLabel =
        layoutEnd(pieces) - pieces[0].start > 60 * 60_000;
    const modeLabel = dragModeLabel(activeDrag);

    const calloutSx = {
        position: "absolute" as const,
        insetInlineStart: "50%",
        transform: "translateX(-50%)",
        whiteSpace: "nowrap" as const,
        fontSize: "0.7rem",
        fontWeight: 700,
        color: theme.palette.common.white,
        bgcolor: alpha(theme.palette.grey[900], 0.85),
        borderRadius: "4px",
        px: 0.6,
        py: 0.15,
        pointerEvents: "none" as const,
        zIndex: 10,
    };

    return (
        <Box sx={{ position: "relative", height: "100%" }}>
            {pieces.map((piece, index) => {
                const isFirst = index === 0;
                const isLast = index === pieces.length - 1;
                const top = percentOf(piece.start);

                return (
                    <Box
                        key={piece.start}
                        sx={{
                            position: "absolute",
                            insetInlineStart: 0,
                            insetInlineEnd: 0,
                            top: `${top}%`,
                            height: `${percentOf(piece.end) - top}%`,
                            bgcolor: bgColor,
                            opacity: 0.85,
                            boxShadow: theme.shadows[4],
                            ...runCornerSx(isFirst, isLast),
                            ...cutEdgeSx(
                                theme.palette.getContrastText(bgColor),
                                isFirst,
                                isLast,
                            ),
                        }}
                    >
                        {isFirst ? (
                            <Box sx={{ ...calloutSx, bottom: "100%", mb: 0.5 }}>
                                {startLabel}
                            </Box>
                        ) : null}
                        {isFirst && modeLabel ? (
                            <Box
                                data-testid="drag-mode-badge"
                                sx={{
                                    ...calloutSx,
                                    insetInlineStart: "auto",
                                    insetInlineEnd: 4,
                                    top: 4,
                                    transform: "none",
                                    bgcolor: theme.palette.primary.main,
                                    color: theme.palette.primary.contrastText,
                                }}
                            >
                                {modeLabel}
                            </Box>
                        ) : null}
                        {isLast && showEndLabel ? (
                            <Box sx={{ ...calloutSx, top: "100%", mt: 0.5 }}>
                                {endLabel}
                            </Box>
                        ) : null}
                    </Box>
                );
            })}
        </Box>
    );
}
