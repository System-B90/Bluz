import { useDroppable } from "@dnd-kit/core";
import { useTheme } from "@mui/material/styles";
import TableRow from "@mui/material/TableRow";
import React, { memo, useMemo } from "react";

import
{
    getRecurrenceOccurrenceDayIds,
    isRecurrenceSatisfied,
} from "@/api-shared/gantt/recurrence";
import { EventRecurrence } from "@/api-shared/types/gantt/models";
import { formatHoursLabel } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { useGanttContext } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context";
import { getFlashRowSx } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/flash";
import
{
    buildDailyEventCells,
    buildWeeklyEventCells,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttEventCells";
import { GanttEventLabelCell } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttEventLabelCell";
import { GanttEventRowProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import { useGanttExecution } from "@/components/gantt/state/execution/hooks";
import
{
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/provider";
import { useGanttRecurrenceExceptions } from "@/components/gantt/state/recurrence-exceptions/hooks";

const GanttEventRowComponent: React.FC<GanttEventRowProps> = ({
    eventId,
    moduleId,
}) =>
{
    const theme = useTheme();
    const state = useCurriculumState();
    const { openEventDialog } = useCurriculumProviderActions();
    const {
        weeklyView,
        relativeDaySizing,
        singleWeekDayZoom,
        timelineWeeks,
        linearDays,
        moduleMappings,
        eventMappings,
        eventSpans,
        violations,
    } = useGanttContext();

    const { isOver: isRemoveOver, setNodeRef: setRemoveNodeRef } = useDroppable(
        {
            id: `drop-remove-event-${eventId}`,
            data: { targetType: "remove", moduleId, eventId },
        },
    );

    const { state: exceptionsState } = useGanttRecurrenceExceptions();
    const { state: executionState } = useGanttExecution();
    const isDrifted = executionState.events[ eventId ]?.drifted ?? false;

    const event = state.events[ eventId ];

    const currentDayId = eventMappings[ eventId ] || null;
    const isEventUnmapped = !currentDayId;

    // Occurrence days this event no longer echoes onto — deleted or
    // materialized into their own standalone event.
    const excludedDayIds = useMemo(() => {
        const set = new Set<string>();
        Object.values(exceptionsState.exceptions).forEach((e) => {
            if (e.eventId === eventId) set.add(e.dayId);
        });
        return set;
    }, [ exceptionsState.exceptions, eventId ]);

    // Multi-day spillover: last occupied day + total covered days (#105).
    const spanInfo = useMemo(() =>
    {
        const span = eventSpans[ eventId ];
        if (!span || !span.spillover || !currentDayId) return null;
        const endDayId = span.dayIds[ span.dayIds.length - 1 ];
        const startIdx = linearDays.indexOf(currentDayId);
        const endIdx = linearDays.indexOf(endDayId);
        if (startIdx === -1 || endIdx <= startIdx) return null;
        return { endDayId, spanDayCount: endIdx - startIdx + 1 };
    }, [ eventSpans, eventId, currentDayId, linearDays ]);
    const myViolations = useMemo(
        () => violations[ eventId ] || [],
        [ eventId, violations ],
    );

    // Zoomed single-week day view: label the block with its required time.
    const timeLabel =
        singleWeekDayZoom && event
            ? formatHoursLabel(event.minimumDuration ?? 0)
            : undefined;

    const recurrence = event?.recurrence ?? EventRecurrence.None;
    const isRecurring = recurrence !== EventRecurrence.None;

    const dayIndexOf = useMemo(
        () => (dayId: string) => state.days[ dayId ]?.dayIndex,
        [ state.days ],
    );

    // Days a recurring event repeats onto (daily view). Daily ⇒ every following
    // day; weekly ⇒ the same weekday in every following week (#111).
    const recurrenceDayIds = useMemo(
        () =>
            getRecurrenceOccurrenceDayIds({
                recurrence,
                startDayId: currentDayId,
                linearDays,
                dayIndexOf,
                excludedDayIds,
            }),
        [ recurrence, currentDayId, linearDays, dayIndexOf, excludedDayIds ],
    );

    // Week holding the event's mapped start day (weekly view repeat blocks, #111).
    const currentWeekIdx = useMemo(() =>
    {
        if (!currentDayId) return -1;
        return timelineWeeks.findIndex((w) => w.days.includes(currentDayId));
    }, [ currentDayId, timelineWeeks ]);

    // Recurrence is satisfied only once an occurrence exists in every week; with
    // forward echoes that means the event starts in the first week (#111).
    const recurrenceSatisfied = isRecurrenceSatisfied(recurrence, currentWeekIdx);

    const firstDayId = timelineWeeks[ 0 ]?.days[ 0 ] ?? null;

    const { isModuleMapped, moduleStartDayId } = useMemo(() =>
    {
        const mappedDays = moduleMappings[ moduleId ] || [];
        const dayIds = new Set<string>(mappedDays);

        const ganttModule = state.modules[ moduleId ];
        if (ganttModule && ganttModule.events)
        {
            ganttModule.events.forEach((eId) =>
            {
                if (eventMappings[ eId ]) dayIds.add(eventMappings[ eId ]);
            });
        }

        const indices = Array.from(dayIds)
            .map((id) => linearDays.indexOf(id))
            .filter((i) => i !== -1);
        const mapped = indices.length > 0;
        const startId = mapped ? linearDays[ Math.min(...indices) ] : null;

        return { isModuleMapped: mapped, moduleStartDayId: startId };
    }, [ moduleId, state.modules, moduleMappings, eventMappings, linearDays ]);

    // In weekly mode, find which week the module start falls in
    const moduleStartWeekIdx = useMemo(() =>
    {
        if (!weeklyView || !moduleStartDayId) return -1;
        return timelineWeeks.findIndex((w) =>
            w.days.includes(moduleStartDayId),
        );
    }, [ weeklyView, moduleStartDayId, timelineWeeks ]);

    const cells = useMemo(() =>
    {
        if (!event) return [];

        return weeklyView
            ? buildWeeklyEventCells({
                timelineWeeks,
                moduleId,
                eventId,
                eventTitle: event.title,
                currentDayId,
                isEventUnmapped,
                isModuleMapped,
                moduleStartWeekIdx,
                violations: myViolations,
                spanInfo,
                relativeDaySizing,
                isRecurring,
                recurrence,
                recurrenceSatisfied,
                currentWeekIdx,
                dayIndexOf,
                excludedDayIds,
            })
            : buildDailyEventCells({
                timelineWeeks,
                moduleId,
                eventId,
                eventTitle: event.title,
                currentDayId,
                isEventUnmapped,
                isModuleMapped,
                moduleStartDayId,
                violations: myViolations,
                spanInfo,
                timeLabel,
                isRecurring,
                recurrenceSatisfied,
                recurrenceDayIds,
                firstDayId,
            });
    }, [
        event,
        weeklyView,
        relativeDaySizing,
        timelineWeeks,
        moduleId,
        eventId,
        currentDayId,
        isEventUnmapped,
        isModuleMapped,
        moduleStartWeekIdx,
        moduleStartDayId,
        myViolations,
        spanInfo,
        timeLabel,
        isRecurring,
        recurrence,
        recurrenceSatisfied,
        currentWeekIdx,
        recurrenceDayIds,
        firstDayId,
        dayIndexOf,
        excludedDayIds,
    ]);

    if (!event) return null;

    return (
        <TableRow
            hover
            id={ `gantt-row-event-${eventId}` }
            sx={ getFlashRowSx(theme) }
        >
            <GanttEventLabelCell
                drifted={ isDrifted }
                eventId={ eventId }
                eventTitle={ event.title }
                isRemoveOver={ isRemoveOver }
                isUnmapped={
                    isEventUnmapped
                        ? isRecurring
                            ? false
                            : !isModuleMapped
                        : null
                }
                moduleId={ moduleId }
                onTitleClick={ () =>
                {
                    const syllabusId = state.modules[ moduleId ]?.syllabusId;
                    if (syllabusId)
                    {
                        openEventDialog(syllabusId, moduleId, eventId);
                    }
                } }
                setRemoveNodeRef={ setRemoveNodeRef }
                violations={ myViolations }
            />

            { cells }
        </TableRow>
    );
};

export const GanttEventRow = memo(GanttEventRowComponent);
