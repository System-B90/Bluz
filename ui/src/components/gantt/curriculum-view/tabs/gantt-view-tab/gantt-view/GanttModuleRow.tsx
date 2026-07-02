import { useDroppable } from "@dnd-kit/core";
import Box from "@mui/material/Box";
import { alpha, useTheme } from "@mui/material/styles";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import React, { memo, useMemo } from "react";

import { useGanttContext } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context";
import { getFlashRowSx } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/flash";
import { GanttBlock } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttBlock";
import { GanttCell } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttCell";
import { GanttEventRow } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttEventRow";
import { GanttModuleRowProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import { useModule } from "@/components/gantt/state/hooks/UseModule";

const GanttModuleRowComponent: React.FC<GanttModuleRowProps> = ({
    moduleId,
}) => {
    const theme = useTheme();
    const ganttModule = useModule(moduleId);
    const {
        weeklyView,
        timelineWeeks,
        linearDays,
        moduleMappings,
        eventMappings,
        violations,
        isModuleExpanded,
        toggleModule,
    } = useGanttContext();
    const isExpanded = isModuleExpanded(moduleId);

    const { isOver: isRemoveOver, setNodeRef: setRemoveNodeRef } = useDroppable(
        {
            id: `drop-remove-module-${moduleId}`,
            data: { targetType: "remove", moduleId, eventId: null },
        },
    );

    const hasEvents = useMemo(
        () => ganttModule?.events && ganttModule?.events.length > 0,
        [ganttModule?.events],
    );
    const mappedDays = useMemo(
        () => moduleMappings[moduleId] || [],
        [moduleId, moduleMappings],
    );
    const myViolations = useMemo(
        () => violations[moduleId] || [],
        [moduleId, violations],
    );

    // Day-level span (used in daily mode)
    const spanIndices = useMemo(() => {
        const dayIds = new Set<string>();

        mappedDays.forEach((d) => dayIds.add(d));

        if (hasEvents) {
            (ganttModule?.events ?? []).forEach((eId) => {
                const d = eventMappings[eId];
                if (d) dayIds.add(d);
            });
        }

        const indices = Array.from(dayIds)
            .map((id) => linearDays.indexOf(id))
            .filter((i) => i !== -1);
        if (indices.length === 0) return null;
        return { min: Math.min(...indices), max: Math.max(...indices) };
    }, [hasEvents, ganttModule?.events, eventMappings, mappedDays, linearDays]);

    // Week-level span (used in weekly mode)
    const weekSpanIndices = useMemo(() => {
        if (!weeklyView) return null;

        const dayIds = new Set<string>();
        mappedDays.forEach((d) => dayIds.add(d));
        if (hasEvents) {
            (ganttModule?.events ?? []).forEach((eId) => {
                const d = eventMappings[eId];
                if (d) dayIds.add(d);
            });
        }

        const weekIndices = new Set<number>();
        dayIds.forEach((dayId) => {
            const weekIdx = timelineWeeks.findIndex((w) =>
                w.days.includes(dayId),
            );
            if (weekIdx !== -1) weekIndices.add(weekIdx);
        });

        if (weekIndices.size === 0) return null;
        const arr = Array.from(weekIndices);
        return { min: Math.min(...arr), max: Math.max(...arr) };
    }, [
        weeklyView,
        mappedDays,
        hasEvents,
        ganttModule?.events,
        eventMappings,
        timelineWeeks,
    ]);

    const isUnmapped = weeklyView
        ? weekSpanIndices === null
        : spanIndices === null;
    const spanLength = weeklyView
        ? weekSpanIndices
            ? weekSpanIndices.max - weekSpanIndices.min + 1
            : 1
        : spanIndices
            ? spanIndices.max - spanIndices.min + 1
            : 1;

    // Build cells depending on view mode. Memoized so a re-render triggered by the
    // remove-target droppable (during a drag) doesn't rebuild every day cell (#88).
    const cells = useMemo(() => {
        if (weeklyView) {
            // Compute proportional pixel positioning for multi-week blocks
            let blockLeftPx: number | undefined;
            let blockWidthPx: number | undefined;

            if (weekSpanIndices !== null && spanIndices !== null) {
                const CELL = 80;
                const firstWeek = timelineWeeks[weekSpanIndices.min];
                const lastWeek = timelineWeeks[weekSpanIndices.max];
                const firstDayLinear = linearDays[spanIndices.min];
                const lastDayLinear = linearDays[spanIndices.max];
                const firstDayPosInWeek =
                    firstWeek.days.indexOf(firstDayLinear);
                const lastDayPosInWeek = lastWeek.days.indexOf(lastDayLinear);

                const startFrac = firstDayPosInWeek / firstWeek.days.length;
                const endFrac = (lastDayPosInWeek + 1) / lastWeek.days.length;
                const weekSpan = weekSpanIndices.max - weekSpanIndices.min;

                blockLeftPx = Math.round(startFrac * CELL) + 2;
                blockWidthPx =
                    Math.round(
                        weekSpan * CELL + endFrac * CELL - startFrac * CELL,
                    ) - 4;
                blockWidthPx = Math.max(blockWidthPx, 16); // minimum visible width
            }

            return timelineWeeks.map((week, weekIdx) => {
                const firstDayId = week.days[0];
                const isSpanStart =
                    weekSpanIndices !== null && weekIdx === weekSpanIndices.min;

                return (
                    <GanttCell
                        blockId={`drag-module-shift-${moduleId}-${firstDayId}`}
                        blockLeftPx={isSpanStart ? blockLeftPx : undefined}
                        blockPayload={{
                            type: "module-shift",
                            moduleId,
                            sourceDayId: firstDayId,
                        }}
                        blockTitle={ganttModule?.title}
                        blockWidthPx={isSpanStart ? blockWidthPx : undefined}
                        dayId={firstDayId}
                        dropId={`drop-module-${moduleId}-${firstDayId}`}
                        elementId={
                            isSpanStart ? `block-module-${moduleId}` : undefined
                        }
                        hasBlock={isSpanStart}
                        isAbsoluteBlock={true}
                        isOpaque={hasEvents ? isExpanded : undefined}
                        key={`week-${week.id}-${moduleId}`}
                        payloadData={{
                            targetType: "module",
                            moduleId,
                            dayId: firstDayId,
                        }}
                        spanLength={spanLength}
                        violations={isSpanStart ? myViolations : undefined}
                    />
                );
            });
        }

        return timelineWeeks.map((week) =>
            week.days.map((dayId) => {
                const dayIndex = linearDays.indexOf(dayId);
                const isSpanStart =
                    spanIndices !== null && dayIndex === spanIndices.min;

                return (
                    <GanttCell
                        blockId={`drag-module-shift-${moduleId}-${dayId}`}
                        blockPayload={{
                            type: "module-shift",
                            moduleId,
                            sourceDayId: dayId,
                        }}
                        blockTitle={ganttModule?.title}
                        dayId={dayId}
                        dropId={`drop-module-${moduleId}-${dayId}`}
                        elementId={
                            isSpanStart ? `block-module-${moduleId}` : undefined
                        }
                        hasBlock={isSpanStart}
                        isAbsoluteBlock={true}
                        isOpaque={hasEvents ? isExpanded : undefined}
                        key={`${dayId}-${moduleId}`}
                        payloadData={{ targetType: "module", moduleId, dayId }}
                        spanLength={spanLength}
                        violations={isSpanStart ? myViolations : undefined}
                    />
                );
            }),
        );
    }, [
        weeklyView,
        timelineWeeks,
        linearDays,
        moduleId,
        ganttModule?.title,
        hasEvents,
        isExpanded,
        spanIndices,
        weekSpanIndices,
        spanLength,
        myViolations,
    ]);

    return (
        <React.Fragment>
            <TableRow
                hover
                id={`gantt-row-module-${moduleId}`}
                sx={getFlashRowSx(theme)}
            >
                <TableCell
                    ref={setRemoveNodeRef}
                    sx={{
                        pl: 4,
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
                        display: "flex",
                        alignItems: "center",
                        height: "100%",
                        transition: "background-color 0.2s",
                    }}
                >
                    {hasEvents ? (
                        <Box
                            component="span"
                            onClick={() => toggleModule(moduleId)}
                            sx={{
                                fontSize: "0.8rem",
                                width: 20,
                                cursor: "pointer",
                                display: "inline-block",
                            }}
                        >
                            {isExpanded ? "▼" : "▶"}
                        </Box>
                    ) : null}
                    {!hasEvents && (
                        <Box sx={{ width: 20, display: "inline-block" }} />
                    )}

                    <Box sx={{ flexGrow: 1, position: "relative" }}>
                        {isUnmapped ? (
                            <GanttBlock
                                elementId={`block-module-${moduleId}`}
                                id={`drag-module-unmapped-${moduleId}`}
                                isAbsolute={false}
                                payload={{ type: "module-map", moduleId }}
                                spanLength={1}
                                title={ganttModule?.title}
                                violations={myViolations}
                            />
                        ) : (
                            <Typography
                                noWrap
                                sx={{ lineHeight: "24px" }}
                                variant="body2"
                            >
                                {ganttModule?.title}
                            </Typography>
                        )}
                    </Box>
                </TableCell>

                {cells}
            </TableRow>

            {isExpanded && hasEvents
                ? ganttModule?.events?.map((eventId) => (
                    <GanttEventRow
                        eventId={eventId}
                        key={eventId}
                        moduleId={moduleId}
                    />
                ))
                : null}
        </React.Fragment>
    );
};

export const GanttModuleRow = memo(GanttModuleRowComponent);
