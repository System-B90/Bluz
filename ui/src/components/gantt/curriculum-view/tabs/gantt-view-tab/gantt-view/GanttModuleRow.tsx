import { useDroppable } from "@dnd-kit/core";
import Box from "@mui/material/Box";
import { alpha, useTheme } from "@mui/material/styles";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import React, { memo, useCallback, useMemo } from "react";

import { useCourses } from "@/components/base/CoursesProvider";
import { formatHours } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { calculateStudentModuleMinutes } from "@/components/gantt/curriculum-view/student-load";
import { useGanttContext } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context";
import { getFlashRowSx } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/flash";
import { GanttCell } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttCell";
import { GanttEventRow } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttEventRow";
import { GanttHoursLabel } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttHoursLabel";
import { GanttUnscheduledChip } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttUnscheduledChip";
import { canDragModule } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/module-drag";
import { getModuleSpanDayIds } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/module-span";
import { RowExpandButton } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/RowExpandButton";
import { GanttModuleRowProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import { eventDisplayOrder } from "@/components/gantt/event-display-order";
import {
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/context";
import { useModule } from "@/components/gantt/state/hooks/UseModule";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";
import { useGanttRecurrenceExceptions } from "@/components/gantt/state/recurrence-exceptions/hooks";

const GanttModuleRowComponent: React.FC<GanttModuleRowProps> = ({
    moduleId,
}) => {
    const theme = useTheme();
    const state = useCurriculumState();
    const ganttModule = useModule(moduleId);
    const { courses } = useCourses();
    const {
        weeklyView,
        singleWeekDayZoom,
        timelineWeeks,
        linearDays,
        allLinearDays,
        dateOfDayId,
        ignoreBreaks,
        dayIndexMap,
        weekIndexByDayId,
        moduleMappings,
        eventMappings,
        eventSpans,
        violations,
        isModuleExpanded,
        toggleModule,
        isEventVisible,
    } = useGanttContext();
    const isExpanded = isModuleExpanded(moduleId);
    const { openModuleDialog } = useCurriculumProviderActions();
    const syllabusId = ganttModule?.syllabusId;
    const openThisModule = useCallback(() => {
        if (syllabusId) openModuleDialog(syllabusId, moduleId);
    }, [openModuleDialog, syllabusId, moduleId]);
    const { state: exceptionsState } = useGanttRecurrenceExceptions();
    const { state: mappingState } = useGanttMappings();

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
    // The module dialog's order, groups gathered (#850).
    const orderedEventIds = useMemo(
        () => eventDisplayOrder(ganttModule?.events ?? [], state.events),
        [ganttModule?.events, state.events],
    );
    const mappedDays = useMemo(
        () => moduleMappings[moduleId] || [],
        [moduleId, moduleMappings],
    );
    const myViolations = useMemo(
        () => violations[moduleId] || [],
        [moduleId, violations],
    );

    // Days the module's block covers — only days its allocated events occupy.
    const allDayIds = useMemo(
        () =>
            getModuleSpanDayIds({
                eventIds: ganttModule?.events ?? [],
                moduleDayIds: mappedDays,
                eventMappings,
                eventSpans,
                exceptions: exceptionsState.exceptions,
                linearDays,
                events: state.events,
                days: state.days,
            }),
        [
            ganttModule?.events,
            eventMappings,
            eventSpans,
            mappedDays,
            linearDays,
            state.events,
            state.days,
            exceptionsState.exceptions,
        ],
    );

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

    const isDraggable = useMemo(
        () =>
            canDragModule(
                { eventIds: ganttModule?.events ?? [], eventMappings },
                linearDays,
            ),
        [ganttModule?.events, eventMappings, linearDays],
    );

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

    const requiredMinutes = useMemo(
        () =>
            ganttModule
                ? calculateStudentModuleMinutes(moduleId, state, courses, {
                    mappings: mappingState.mappings,
                    exceptions: exceptionsState.exceptions,
                    linearDays: allLinearDays,
                    dateOf: dateOfDayId,
                }, ignoreBreaks)
                : 0,
        [ganttModule, moduleId, state, courses, mappingState.mappings, exceptionsState.exceptions, allLinearDays, dateOfDayId, ignoreBreaks],
    );
    // Time the module has in the zoomed week (#799).
    const weekMinutes = useMemo(
        () =>
            singleWeekDayZoom && ganttModule
                ? calculateStudentModuleMinutes(moduleId, state, courses, {
                    mappings: mappingState.mappings,
                    exceptions: exceptionsState.exceptions,
                    linearDays: allLinearDays,
                    onlyDayIds: new Set(linearDays),
                    dateOf: dateOfDayId,
                }, ignoreBreaks)
                : 0,
        [singleWeekDayZoom, ganttModule, moduleId, state, courses, mappingState.mappings, exceptionsState.exceptions, allLinearDays, linearDays, dateOfDayId, ignoreBreaks],
    );
    // Zoomed single-week day view: label the module block with this week's time out of its total.
    const timeLabel = singleWeekDayZoom && ganttModule
        ? `${formatHours(weekMinutes, { unit: true })} / ${formatHours(requiredMinutes, { unit: true })}`
        : undefined;

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

                // A single-week module fills its whole column instead of a thin
                // intra-week sliver. A cross-week span keeps its true edges —
                // snapping it would cover event-less days and drop its tail.
                if (weekSpan === 0) {
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
                        blockMinutes={requiredMinutes}
                        blockPayload={{
                            type: "module-shift",
                            moduleId,
                            sourceDayId: firstDayId,
                        }}
                        blockTitle={ganttModule?.title}
                        blockWidthPercent={isSpanStart ? blockWidthPercent : undefined}
                        dayId={firstDayId}
                        disableDrag={!isDraggable}
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
                        blockMinutes={requiredMinutes}
                        blockPayload={{
                            type: "module-shift",
                            moduleId,
                            sourceDayId: dayId,
                        }}
                        blockTimeLabel={isSpanStart ? timeLabel : undefined}
                        blockTitle={ganttModule?.title}
                        dayId={dayId}
                        disableDrag={singleWeekDayZoom || !isDraggable}
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
        requiredMinutes,
        hasEvents,
        isExpanded,
        spanIndices,
        weekSpanIndices,
        spanLength,
        myViolations,
        timeLabel,
        singleWeekDayZoom,
        isDraggable,
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
                        <RowExpandButton
                            expanded={isExpanded}
                            name={ganttModule?.title ?? ""}
                            onToggle={() => toggleModule(moduleId)}
                        />
                    ) : (
                        <Box sx={{ width: 24, flexShrink: 0 }} />
                    )}

                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography
                            noWrap
                            sx={{ lineHeight: "24px" }}
                            variant="body2"
                        >
                            {ganttModule?.title}
                        </Typography>
                    </Box>
                    {/* Not on the timeline: the name stays, plus a handle that
                        can't be mistaken for a scheduled bar (#817). */}
                    {isUnmapped ? (
                        <GanttUnscheduledChip
                            disableDrag={!isDraggable}
                            moduleId={moduleId}
                            moduleTitle={ganttModule?.title ?? ""}
                            onOpen={openThisModule}
                            violations={myViolations}
                        />
                    ) : null}
                    <GanttHoursLabel minutes={requiredMinutes} />
                </TableCell>

                {cells}
            </TableRow>

            {isExpanded && hasEvents
                ? orderedEventIds
                    .filter((eventId) => isEventVisible(eventId))
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
