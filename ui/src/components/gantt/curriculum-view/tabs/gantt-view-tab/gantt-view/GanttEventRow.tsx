import { useDroppable } from "@dnd-kit/core";
import Box from "@mui/material/Box";
import { alpha, useTheme } from "@mui/material/styles";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import React, { useMemo } from "react";

import { useGanttContext } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context";
import { GanttBlock } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttBlock";
import { GanttCell } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttCell";
import { GanttEventRowProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import {
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/provider";

export const GanttEventRow: React.FC<GanttEventRowProps> = ({
    eventId,
    moduleId,
}) => {
    const theme = useTheme();
    const state = useCurriculumState();
    const { openEventDialog } = useCurriculumProviderActions();
    const {
        weeklyView,
        timelineWeeks,
        linearDays,
        moduleMappings,
        eventMappings,
        violations,
    } = useGanttContext();

    const { isOver: isRemoveOver, setNodeRef: setRemoveNodeRef } = useDroppable(
        {
            id: `drop-remove-event-${eventId}`,
            data: { targetType: "remove", moduleId, eventId },
        },
    );

    const event = state.events[eventId];

    const currentDayId = eventMappings[eventId];
    const isEventUnmapped = !currentDayId;
    const myViolations = violations[eventId] || [];

    const { isModuleMapped, moduleStartDayId } = useMemo(() => {
        const mappedDays = moduleMappings[moduleId] || [];
        const dayIds = new Set<string>(mappedDays);

        const ganttModule = state.modules[moduleId];
        if (ganttModule && ganttModule.events) {
            ganttModule.events.forEach((eId) => {
                if (eventMappings[eId]) dayIds.add(eventMappings[eId]);
            });
        }

        const indices = Array.from(dayIds)
            .map((id) => linearDays.indexOf(id))
            .filter((i) => i !== -1);
        const mapped = indices.length > 0;
        const startId = mapped ? linearDays[Math.min(...indices)] : null;

        return { isModuleMapped: mapped, moduleStartDayId: startId };
    }, [moduleId, state.modules, moduleMappings, eventMappings, linearDays]);

    // In weekly mode, find which week the module start falls in
    const moduleStartWeekIdx = useMemo(() => {
        if (!weeklyView || !moduleStartDayId) return -1;
        return timelineWeeks.findIndex((w) =>
            w.days.includes(moduleStartDayId),
        );
    }, [weeklyView, moduleStartDayId, timelineWeeks]);

    if (!event) return null;

    const renderCells = () => {
        if (weeklyView) {
            return timelineWeeks.map((week, weekIdx) => {
                const firstDayId = week.days[0];

                // Check if this event is mapped to any day in this week
                const isExplicitlyMappedHere = currentDayId
                    ? week.days.includes(currentDayId)
                    : false;
                const isWaitingInModuleStartColumn =
                    isEventUnmapped &&
                    isModuleMapped &&
                    weekIdx === moduleStartWeekIdx;
                const hasBlock =
                    isExplicitlyMappedHere || isWaitingInModuleStartColumn;

                const blockPayload = isExplicitlyMappedHere
                    ? {
                        type: "event-move",
                        moduleId,
                        eventId,
                        sourceDayId: currentDayId,
                    }
                    : { type: "event-map", moduleId, eventId };

                const blockId = isExplicitlyMappedHere
                    ? `drag-event-${eventId}-${currentDayId}`
                    : `drag-event-staged-${eventId}`;

                // Proportional positioning within the week column
                let eventLeftPx: number | undefined;
                let eventWidthPx: number | undefined;
                if (isExplicitlyMappedHere && currentDayId) {
                    const CELL = 80;
                    const dayPosInWeek = week.days.indexOf(currentDayId);
                    const startFrac = dayPosInWeek / week.days.length;
                    const endFrac = (dayPosInWeek + 1) / week.days.length;
                    eventLeftPx = Math.round(startFrac * CELL) + 2;
                    eventWidthPx = Math.max(
                        Math.round((endFrac - startFrac) * CELL) - 4,
                        16,
                    );
                }

                return (
                    <GanttCell
                        blockId={blockId}
                        blockLeftPx={
                            isExplicitlyMappedHere ? eventLeftPx : undefined
                        }
                        blockPayload={blockPayload}
                        blockTitle={event.title}
                        blockWidthPx={
                            isExplicitlyMappedHere ? eventWidthPx : undefined
                        }
                        dayId={firstDayId}
                        dropId={`drop-event-${eventId}-${firstDayId}`}
                        elementId={
                            hasBlock ? `block-event-${eventId}` : undefined
                        }
                        hasBlock={hasBlock}
                        isAbsoluteBlock={true}
                        isOpaque={isWaitingInModuleStartColumn}
                        key={`week-${week.id}-${eventId}`}
                        payloadData={{
                            targetType: "event",
                            eventId,
                            dayId: firstDayId,
                        }}
                        violations={hasBlock ? myViolations : undefined}
                    />
                );
            });
        }

        return timelineWeeks.map((week) =>
            week.days.map((dayId) => {
                const isExplicitlyMappedHere = currentDayId === dayId;
                const isWaitingInModuleStartColumn =
                    isEventUnmapped &&
                    isModuleMapped &&
                    moduleStartDayId === dayId;
                const hasBlock =
                    isExplicitlyMappedHere || isWaitingInModuleStartColumn;

                const blockPayload = isExplicitlyMappedHere
                    ? {
                        type: "event-move",
                        moduleId,
                        eventId,
                        sourceDayId: dayId,
                    }
                    : { type: "event-map", moduleId, eventId };

                const blockId = isExplicitlyMappedHere
                    ? `drag-event-${eventId}-${dayId}`
                    : `drag-event-staged-${eventId}`;

                return (
                    <GanttCell
                        blockId={blockId}
                        blockPayload={blockPayload}
                        blockTitle={event.title}
                        dayId={dayId}
                        dropId={`drop-event-${eventId}-${dayId}`}
                        elementId={
                            hasBlock ? `block-event-${eventId}` : undefined
                        }
                        hasBlock={hasBlock}
                        isAbsoluteBlock={true}
                        isOpaque={isWaitingInModuleStartColumn}
                        key={`${dayId}-${eventId}`}
                        payloadData={{ targetType: "event", eventId, dayId }}
                        violations={hasBlock ? myViolations : undefined}
                    />
                );
            }),
        );
    };

    return (
        <TableRow hover>
            <TableCell
                ref={setRemoveNodeRef}
                sx={{
                    pl: 8,
                    width: 250,
                    minWidth: 250,
                    maxWidth: 250,
                    boxSizing: "border-box",
                    position: "sticky",
                    left: 0,
                    zIndex: 5,
                    backgroundColor: isRemoveOver
                        ? alpha(theme.palette.error.main, 0.08)
                        : theme.vars.palette.background.paper,
                    borderRight: `1px solid ${theme.vars.palette.divider}`,
                    transition: "background-color 0.2s",
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                }}
            >
                <Typography
                    color="text.secondary"
                    noWrap
                    onClick={() => {
                        const syllabusId = state.modules[moduleId]?.syllabusId;
                        if (syllabusId) {
                            openEventDialog(syllabusId, moduleId, eventId);
                        }
                    }}
                    sx={{
                        display: "block",
                        cursor: "pointer",
                        "&:hover": {
                            color: "primary.main",
                            textDecoration: "underline",
                        },
                    }}
                    title="עריכת המופע"
                    variant="caption"
                >
                    ↳ {event.title}
                </Typography>

                {isEventUnmapped && !isModuleMapped ? (
                    <Box
                        sx={{
                            flexGrow: 1,
                            position: "relative",
                            ml: 1,
                            height: "24px",
                        }}
                    >
                        <GanttBlock
                            elementId={`block-event-${eventId}`}
                            id={`drag-event-unmapped-${eventId}`}
                            isAbsolute={false}
                            payload={{ type: "event-map", moduleId, eventId }}
                            title={event.title}
                            violations={myViolations}
                        />
                    </Box>
                ) : null}
            </TableCell>

            {renderCells()}
        </TableRow>
    );
};
