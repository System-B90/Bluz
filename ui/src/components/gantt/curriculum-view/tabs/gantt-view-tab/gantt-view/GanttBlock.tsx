import { useDraggable } from "@dnd-kit/core";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import RepeatIcon from "@mui/icons-material/Repeat";
import Box from "@mui/material/Box";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { alpha, useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React, { memo, useState } from "react";

import { formatHoursLabel } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { buildBlockTooltip } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/block-tooltip";
import { GanttBlockProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import {
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/context";
import { useGanttRecurrenceExceptions } from "@/components/gantt/state/recurrence-exceptions/hooks";

const GanttBlockComponent: React.FC<GanttBlockProps> = ({
    id,
    payload,
    title,
    timeLabel,
    isOpaque,
    spanLength = 1,
    isAbsolute = true,
    elementId,
    violations = [],
    minutes,
    blockLeftPercent,
    blockWidthPercent,
    isSpillover = false,
    isRecurrence = false,
    isSkipped = false,
    disableDrag = false,
    onDoubleClick,
}) => {
    const theme = useTheme();
    const state = useCurriculumState();
    const { openModuleDialog, openEventDialog } = useCurriculumProviderActions();
    const { materializeOccurrence, restoreOccurrence } =
        useGanttRecurrenceExceptions();

    // A concrete occurrence (as opposed to the non-interactive "unallocated"
    // reminder marker) carries its own dayId and can be dragged/materialized.
    const isOccurrence = payload?.type === "event-occurrence";
    // A skipped occurrence is a placeholder for something that is *not* there:
    // never draggable, but double-click brings it back (#469).
    const isSkippedOccurrence = payload?.type === "event-skipped-occurrence";

    const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({
            id,
            // The reminder marker is a pure display cue with no day of its own —
            // never draggable. Occurrence blocks *are* draggable (drag-to-remove).
            disabled:
                (isRecurrence && !isOccurrence) ||
                isSkippedOccurrence ||
                disableDrag,
            data: payload,
        });

    const dragProps =
        (isRecurrence && !isOccurrence) || isSkippedOccurrence || disableDrag
            ? {}
            : { ...listeners, ...attributes };

    // Opening a bar must never change data (#833): an occurrence of a
    // recurring event asks first, since editing just this one materializes
    // it into a standalone event.
    const [ occurrenceMenu, setOccurrenceMenu ] = useState<HTMLElement | null>(null);

    const openSeries = () => {
        const syllabusId = payload?.moduleId ? state.modules[payload.moduleId]?.syllabusId : undefined;
        if (!syllabusId || !payload || !("eventId" in payload) || !payload.eventId) return;
        openEventDialog(syllabusId, payload.moduleId, payload.eventId);
    };

    const editThisOccurrence = async () => {
        if (payload?.type !== "event-occurrence") return;
        const syllabusId = state.modules[payload.moduleId]?.syllabusId;
        if (!syllabusId) return;
        const result = await materializeOccurrence({
            moduleId: payload.moduleId,
            eventId: payload.eventId,
            dayId: payload.dayId,
        });
        if (result) openEventDialog(syllabusId, payload.moduleId, result.event.id);
    };

    // Double-click and Enter (#833) both land here.
    const activate = async (anchor: HTMLElement) => {
        if (!payload || !payload.moduleId) return;

        if (onDoubleClick) {
            onDoubleClick();
            return;
        }

        if (isSkippedOccurrence) {
            await restoreOccurrence({
                eventId: payload.eventId,
                dayId: payload.dayId,
            });
            return;
        }

        const moduleObj = state.modules[payload.moduleId];
        if (!moduleObj?.syllabusId) return;

        if (isOccurrence) {
            setOccurrenceMenu(anchor);
            return;
        }

        if ("eventId" in payload && payload.eventId) {
            openEventDialog(moduleObj.syllabusId, payload.moduleId, payload.eventId);
        } else {
            openModuleDialog(moduleObj.syllabusId, payload.moduleId);
        }
    };

    const handleDoubleClick = (e: React.MouseEvent<HTMLElement>) => {
        if (!payload || !payload.moduleId) return;
        e.stopPropagation();
        e.preventDefault();
        void activate(e.currentTarget);
    };

    // Enter opens; every other key (Space picks the bar up, #808) goes on
    // to dnd-kit.
    const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Enter" && payload?.moduleId) {
            e.preventDefault();
            e.stopPropagation();
            void activate(e.currentTarget);
            return;
        }
        (dragProps as { onKeyDown?: (event: React.KeyboardEvent) => void }).onKeyDown?.(e);
    };

    // Bars dnd-kit doesn't manage still open with Enter, so they need a
    // Tab stop of their own. The reminder marker opens nothing.
    const isActivatable = Boolean(payload?.moduleId) && !(isRecurrence && !isOccurrence && !isSkippedOccurrence);
    const focusProps = isActivatable && !("tabIndex" in dragProps)
        ? { role: "button", tabIndex: 0 }
        : {};

    const style = transform
        ? {
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0)${isDragging ? " rotate(2.5deg) scale(1.02)" : ""}`,
            zIndex: 9999,
        }
        : undefined;

    const blockWidth =
        blockWidthPercent !== undefined
            ? `calc(${blockWidthPercent}% - 4px)`
            : spanLength > 1
                ? `calc(${spanLength * 100}% - 8px)`
                : isAbsolute
                    ? "calc(100% - 8px)"
                    : "100%";

    const isViolated = violations.length > 0;

    // Multi-day overflow blocks fade out toward the spilled days (#105).
    const spilloverBackground =
        isSpillover && !isOpaque
            ? `linear-gradient(to left, ${theme.palette.primary.main} 55%, ${alpha(
                theme.palette.primary.main,
                0.45,
            )} 100%)`
            : undefined;

    const block = (
        <Box
            data-gantt-recurrence={isRecurrence ? true : undefined}
            data-gantt-skipped={isSkipped ? true : undefined}
            id={elementId}
            ref={setNodeRef}
            {...dragProps}
            {...focusProps}
            onDoubleClick={handleDoubleClick}
            onKeyDown={handleKeyDown}
            sx={{
                position: isAbsolute ? "absolute" : "relative",
                top: isAbsolute ? "5px" : "auto",
                bottom: isAbsolute ? "5px" : "auto",
                left: isAbsolute
                    ? blockLeftPercent !== undefined
                        ? `calc(${blockLeftPercent}% + 2px)`
                        : "4px"
                    : "auto",
                width: blockWidth,
                height: "24px",
                backgroundColor: isSkipped
                    ? "transparent"
                    : isOpaque
                        ? "transparent"
                        : isRecurrence
                            ? alpha(theme.palette.primary.main, 0.4)
                            : theme.palette.primary.main,
                backgroundImage: spilloverBackground,
                borderRadius: "4px",
                border: isSkipped
                    ? `1px dashed ${theme.palette.text.disabled}`
                    : isViolated
                        ? `2px solid ${theme.palette.error.main}`
                        : isOpaque
                            ? `1px solid ${theme.palette.primary.main}`
                            : isRecurrence
                                ? `1px dashed ${theme.palette.primary.main}`
                                : "none",
                cursor: isSkippedOccurrence
                    ? "pointer"
                    : (isRecurrence && !isOccurrence) || disableDrag
                        ? "default"
                        : isDragging
                            ? "grabbing"
                            : "grab",
                opacity: isDragging ? 0.8 : 1,
                boxShadow: isDragging
                    ? "0 10px 25px rgba(0, 0, 0, 0.2)"
                    : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: timeLabel ? "space-between" : "center",
                gap: 0.5,
                overflow: "hidden",
                px: 1,
                boxSizing: "border-box",
                zIndex: isDragging ? 9999 : 1,
                ...style,
            }}
        >
            {isSkipped ? (
                <EventBusyIcon
                    sx={{
                        color: "text.disabled",
                        fontSize: "0.9rem",
                        flexShrink: 0,
                    }}
                />
            ) : isRecurrence ? (
                <RepeatIcon
                    sx={{
                        color: "primary.main",
                        fontSize: "0.9rem",
                        flexShrink: 0,
                    }}
                />
            ) : null}
            {title ? (
                <Typography
                    sx={{
                        color: isSkipped
                            ? "text.disabled"
                            : isOpaque || isRecurrence
                                ? "primary.main"
                                : "primary.contrastText",
                        textDecoration: isSkipped ? "line-through" : undefined,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                    variant="caption"
                >
                    {title}
                </Typography>
            ) : null}
            {timeLabel ? (
                <Typography
                    sx={{
                        color: isOpaque
                            ? "primary.main"
                            : "primary.contrastText",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                        opacity: 0.9,
                    }}
                    variant="caption"
                >
                    {timeLabel}
                </Typography>
            ) : null}
        </Box>
    );

    const spilloverNote = isSpillover ? "גולש על פני מספר ימים" : "";
    const recurrenceNote = isRecurrence && !isSkipped ? "מופע חוזר" : "";
    // The skipped ghost has to explain itself: it looks like an absence, and
    // the way back is a double-click (#469).
    const skippedNote = isSkipped
        ? "מופע חוזר שדולג — לחיצה כפולה תחזיר אותו"
        : "";
    // Full name (the bar truncates it), tree path and hours (#828).
    const moduleObj = payload?.moduleId ? state.modules[payload.moduleId] : undefined;
    const eventObj = payload && "eventId" in payload && payload.eventId
        ? state.events[payload.eventId]
        : undefined;
    const syllabusTitle = moduleObj?.syllabusId
        ? state.syllabuses[moduleObj.syllabusId]?.title
        : undefined;
    const tooltipMinutes = minutes ?? eventObj?.minimumDuration;
    const tooltipContent = buildBlockTooltip({
        title,
        path: eventObj ? [syllabusTitle, moduleObj?.title] : [syllabusTitle],
        hoursLabel: tooltipMinutes ? formatHoursLabel(tooltipMinutes) : undefined,
        notes: [recurrenceNote, skippedNote, spilloverNote, ...violations],
    });

    const occurrenceChoice = occurrenceMenu ? (
        <Menu
            anchorEl={occurrenceMenu}
            onClose={() => setOccurrenceMenu(null)}
            open
        >
            <MenuItem
                onClick={() => {
                    setOccurrenceMenu(null);
                    openSeries();
                }}
            >
                <ListItemText
                    primary="פתיחת האירוע החוזר"
                    secondary="צפייה ועריכה של כל המופעים, בלי לשנות דבר"
                />
            </MenuItem>
            <MenuItem
                onClick={() => {
                    setOccurrenceMenu(null);
                    void editThisOccurrence();
                }}
            >
                <ListItemText
                    primary="עריכת מופע זה בלבד"
                    secondary="יוצר ממנו מפגש נפרד"
                />
            </MenuItem>
        </Menu>
    ) : null;

    const withTooltip = tooltipContent ? (
        <Tooltip
            arrow
            placement="top"
            slotProps={{ tooltip: { sx: { whiteSpace: "pre-line" } } }}
            title={tooltipContent}
        >
            {block}
        </Tooltip>
    ) : (
        block
    );

    return (
        <>
            {withTooltip}
            {occurrenceChoice}
        </>
    );
};

export const GanttBlock = memo(GanttBlockComponent);
