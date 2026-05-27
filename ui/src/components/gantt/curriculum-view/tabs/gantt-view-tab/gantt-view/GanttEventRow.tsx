import { useDroppable } from "@dnd-kit/core";
import {
    alpha,
    Box,
    TableCell,
    TableRow,
    Typography,
    useTheme,
} from "@mui/material";
import React, { useMemo } from "react";

import { useGanttContext } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context";
import { GanttBlock } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttBlock";
import { GanttCell } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttCell";
import { GanttEventRowProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import { useCurriculumState } from "@/components/gantt/state/provider";

export const GanttEventRow: React.FC<GanttEventRowProps> = ({
    eventId,
    moduleId,
}) => {
    const theme = useTheme();
    const state = useCurriculumState();
    const {
        timelineWeeks,
        linearDays,
        moduleMappings,
        eventMappings,
        violations,
    } = useGanttContext();

    const { isOver: isRemoveOver, setNodeRef: setRemoveNodeRef } = useDroppable({
        id: `drop-remove-event-${eventId}`,
        data: { targetType: "remove", moduleId, eventId },
    });

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

    if (!event) return null;

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
                        : theme.palette.background.paper,
                    borderRight: `1px solid ${theme.palette.divider}`,
                    transition: "background-color 0.2s",
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                }}
            >
                <Typography
                    color="text.secondary"
                    noWrap
                    sx={{ display: "block" }}
                    variant="caption"
                >
          ↳ {event.title}
                </Typography>

                {isEventUnmapped && !isModuleMapped ? (
                    <Box
                        sx={{ flexGrow: 1, position: "relative", ml: 1, height: "24px" }}
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

            {timelineWeeks.map((week) =>
                week.days.map((dayId) => {
                    const isExplicitlyMappedHere = currentDayId === dayId;
                    const isWaitingInModuleStartColumn =
            isEventUnmapped && isModuleMapped && moduleStartDayId === dayId;
                    const hasBlock =
            isExplicitlyMappedHere || isWaitingInModuleStartColumn;

                    const blockPayload = isExplicitlyMappedHere
                        ? { type: "event-move", moduleId, eventId, sourceDayId: dayId }
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
                            elementId={hasBlock ? `block-event-${eventId}` : undefined}
                            hasBlock={hasBlock}
                            isAbsoluteBlock={true}
                            isOpaque={isWaitingInModuleStartColumn}
                            key={`${dayId}-${eventId}`}
                            payloadData={{ targetType: "event", eventId, dayId }}
                            violations={hasBlock ? myViolations : undefined}
                        />
                    );
                }),
            )}
        </TableRow>
    );
};
