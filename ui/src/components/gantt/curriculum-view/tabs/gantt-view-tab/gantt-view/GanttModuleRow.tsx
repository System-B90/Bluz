import { useDroppable } from "@dnd-kit/core";
import Box from "@mui/material/Box";
import { alpha, useTheme } from "@mui/material/styles";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import React, { memo, useMemo } from "react";

import { getRecurrenceOccurrenceDayIds } from "@/api-shared/gantt/recurrence";
import { EventRecurrence } from "@/api-shared/types/gantt/models";
import { formatHoursLabel } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { useGanttContext } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context";
import { getFlashRowSx } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/flash";
import { GanttBlock } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttBlock";
import { GanttCell } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttCell";
import { GanttEventRow } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttEventRow";
import { GanttModuleRowProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import { useModule } from "@/components/gantt/state/hooks/UseModule";
import { useCurriculumState } from "@/components/gantt/state/provider";
import { useGanttRecurrenceExceptions } from "@/components/gantt/state/recurrence-exceptions/hooks";
import { calculateMinimumRequiredTimeForModule } from "@/components/gantt/utils";

const GanttModuleRowComponent: React.FC<GanttModuleRowProps> = ({
    moduleId,
}) => {
    const theme = useTheme();
    const state = useCurriculumState();
    const ganttModule = useModule(moduleId);
    const {
        weeklyView,
        singleWeekDayZoom,
        timelineWeeks,
        linearDays,
        dayIndexMap,
        weekIndexByDayId,
        moduleMappings,
        eventMappings,
        violations,
        isModuleExpanded,
        toggleModule,
        searchActive,
        isEventVisible,
        singleWeekDayZoom,
    } = useGanttContext();
    // While searching, force the module open so matching events show (#323).
    const isExpanded = searchActive || isModuleExpanded(moduleId);
    const { state: exceptionsState } = useGanttRecurrenceExceptions();

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

    // Every day the module's block should visually cover: explicit mappings
    // plus, for recurring events, every surviving echoed occurrence day — so
    // the block spans the full recurrence, not just its start.
    const allDayIds = useMemo(() => {
        const dayIds = new Set<string>();
        mappedDays.forEach((d) => dayIds.add(d));

        if (hasEvents) {
            (ganttModule?.events ?? []).forEach((eId) => {
                const startDayId = eventMappings[eId];
                if (!startDayId) return;
                dayIds.add(startDayId);

                const recurrence = state.events[eId]?.recurrence ?? EventRecurrence.None;
                if (recurrence === EventRecurrence.None) return;

                const excludedDayIds = new Set<string>();
                Object.values(exceptionsState.exceptions).forEach((ex) => {
                    if (ex.eventId === eId) excludedDayIds.add(ex.dayId);
                });

                getRecurrenceOccurrenceDayIds({
                    recurrence,
                    startDayId,
                    linearDays,
                    dayIndexOf: (d) => state.days[d]?.dayIndex,
                    excludedDayIds,
                }).forEach((d) => dayIds.add(d));
            });
        }

        return dayIds;
    }, [
        hasEvents,
        ganttModule?.events,
        eventMappings,
        mappedDays,
        linearDays,
        state.events,
        state.days,
        exceptionsState.exceptions,
    ]);

    // Day-level span (used in daily mode)
    const spanIndices = useMemo(() => {
        const indices = Array.from(allDayIds)
            .map((id) => dayIndexMap.get(id) ?? -1)
            .filter((i) => i !== -1);
        if (indices.length === 0) return null;
        return { min: Math.min(...indices), max: Math.max(...indices) };
    }, [allDayIds, dayIndexMap]);

    // Week-level span (used in weekly mode)
    const weekSpanIndices = useMemo(() => {
        if (!weeklyView) return null;

        const weekIndices = new Set<number>();
        allDayIds.forEach((dayId) => {
            const weekIdx = weekIndexByDayId.get(dayId);
            if (weekIdx !== undefined) weekIndices.add(weekIdx);
        });

        if (weekIndices.size === 0) return null;
        const arr = Array.from(weekIndices);
        return { min: Math.min(...arr), max: Math.max(...arr) };
    }, [weeklyView, allDayIds, weekIndexByDayId]);

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

    // Zoomed single-week day view: label the module block with its required time.
    const timeLabel = useMemo(
        () =>
            singleWeekDayZoom && ganttModule
                ? formatHoursLabel(
                    calculateMinimumRequiredTimeForModule(ganttModule, state),
                )
                : undefined,
        [singleWeekDayZoom, ganttModule, state],
    );

    // Build cells depending on view mode. Memoized so a re-render triggered by the
    // remove-target droppable (during a drag) doesn't rebuild every day cell (#88).
    const cells = useMemo(() => {
        if (weeklyView) {
            // Position multi-week blocks as percentages of the anchor cell's own
            // width rather than fixed pixels — week columns render wider than
            // their nominal size (the table stretches fixed-width columns to
            // fill the container), so a pixel-based width would undershoot the
            // real span (#118).
            let blockLeftPercent: number | undefined;
            let blockWidthPercent: number | undefined;

            if (weekSpanIndices !== null && spanIndices !== null) {
                const firstWeek = timelineWeeks[weekSpanIndices.min];
                const lastWeek = timelineWeeks[weekSpanIndices.max];
                const firstDayLinear = linearDays[spanIndices.min];
                const lastDayLinear = linearDays[spanIndices.max];
                const firstDayPosInWeek =
                    firstWeek.days.indexOf(firstDayLinear);
                const lastDayPosInWeek = lastWeek.days.indexOf(lastDayLinear);

                // Module blocks always span from the first mapped event/day to
                // the last, regardless of the toggle — only individual event
                // blocks shrink to their own day in relative mode.
                const startFrac = firstDayPosInWeek / firstWeek.days.length;
                const endFrac = (lastDayPosInWeek + 1) / lastWeek.days.length;
                const weekSpan = weekSpanIndices.max - weekSpanIndices.min;

                const naturalWidth =
                    weekSpan * 100 + (endFrac - startFrac) * 100;

                // A module block always fills at least one full column: when it
                // would render narrower than a single week, snap it to the whole
                // starting column instead of a thin intra-week sliver.
                if (naturalWidth < 100) {
                    blockLeftPercent = 0;
                    blockWidthPercent = 100;
                } else {
                    blockLeftPercent = startFrac * 100;
                    blockWidthPercent = naturalWidth;
                }
            }

            return timelineWeeks.map((week, weekIdx) => {
                const firstDayId = week.days[0];
                const isSpanStart =
                    weekSpanIndices !== null && weekIdx === weekSpanIndices.min;

                return (
                    <GanttCell
                        blockId={`drag-module-shift-${moduleId}-${firstDayId}`}
                        blockLeftPercent={isSpanStart ? blockLeftPercent : undefined}
                        blockPayload={{
                            type: "module-shift",
                            moduleId,
                            sourceDayId: firstDayId,
                        }}
                        blockTitle={ganttModule?.title}
                        blockWidthPercent={isSpanStart ? blockWidthPercent : undefined}
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
                const dayIndex = dayIndexMap.get(dayId) ?? -1;
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
                        blockTimeLabel={isSpanStart ? timeLabel : undefined}
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
        dayIndexMap,
        moduleId,
        ganttModule?.title,
        hasEvents,
        isExpanded,
        spanIndices,
        weekSpanIndices,
        spanLength,
        myViolations,
        timeLabel,
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
                ? ganttModule?.events
                    ?.filter((eventId) => isEventVisible(eventId))
                    .filter((eventId) => {
                        if (!singleWeekDayZoom) return true;
                        const mappedDayId = eventMappings[eventId];
                        // Unmapped events stay visible (draggable placeholder);
                        // mapped events only show while their day is in view.
                        return !mappedDayId || dayIndexMap.has(mappedDayId);
                    })
                    .map((eventId) => (
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
