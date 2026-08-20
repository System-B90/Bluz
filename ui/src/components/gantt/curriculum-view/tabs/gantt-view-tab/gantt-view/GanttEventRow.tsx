import { useDroppable } from "@dnd-kit/core";
import { useTheme } from "@mui/material/styles";
import TableRow from "@mui/material/TableRow";
import React, { memo, useCallback, useMemo } from "react";

import
{
    getFirstRequiredRecurrenceWeekIdx,
    getRecurrenceOccurrenceDayIds,
    isDayInRecurrenceWindow,
    isRecurrenceSatisfied,
} from "@/api-shared/gantt/recurrence";
import { EventRecurrence, getAllowedDayIndices } from "@/api-shared/types/gantt/models";
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
        dayIndexMap,
        weekIndexByDayId,
        dateOfDayId,
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

    // Of those, the ones that were merely skipped: a materialized occurrence
    // already has a standalone block on that day, so only these get a ghost
    // and can be restored (#469).
    const skippedDayIds = useMemo(() => {
        const set = new Set<string>();
        Object.values(exceptionsState.exceptions).forEach((e) => {
            if (e.eventId === eventId && !e.materializedEventId) set.add(e.dayId);
        });
        return set;
    }, [ exceptionsState.exceptions, eventId ]);

    // Multi-day spillover: last occupied day + total covered days (#105).
    const spanInfo = useMemo(() =>
    {
        const span = eventSpans[ eventId ];
        if (!span || !span.spillover || !currentDayId) return null;
        const endDayId = span.dayIds[ span.dayIds.length - 1 ];
        const startIdx = dayIndexMap.get(currentDayId) ?? -1;
        const endIdx = dayIndexMap.get(endDayId) ?? -1;
        if (startIdx === -1 || endIdx <= startIdx) return null;
        return { endDayId, spanDayCount: endIdx - startIdx + 1 };
    }, [ eventSpans, eventId, currentDayId, dayIndexMap ]);
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
    // Optional recurrence window: null bounds mean "unbounded" (#468).
    const recurrenceStartDate = event?.recurrenceStartDate ?? null;
    const recurrenceEndDate = event?.recurrenceEndDate ?? null;

    const dayIndexOf = useMemo(
        () => (dayId: string) => state.days[ dayId ]?.dayIndex,
        [ state.days ],
    );

    // Weekdays this event's temporal constraints permit; recurrence never
    // echoes onto a day outside this set (#111 follow-up).
    const allowedDayIndices = useMemo(
        () => getAllowedDayIndices(event?.constraints),
        [ event?.constraints ],
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
                recurrenceStartDate,
                recurrenceEndDate,
                dateOf: dateOfDayId,
                allowedDayIndices,
            }),
        [
            recurrence,
            currentDayId,
            linearDays,
            dayIndexOf,
            excludedDayIds,
            recurrenceStartDate,
            recurrenceEndDate,
            dateOfDayId,
            allowedDayIndices,
        ],
    );

    // Week holding the event's mapped start day (weekly view repeat blocks, #111).
    const currentWeekIdx = useMemo(() =>
    {
        if (!currentDayId) return -1;
        return weekIndexByDayId.get(currentDayId) ?? -1;
    }, [ currentDayId, weekIndexByDayId ]);

    // Recurrence is satisfied only once an occurrence exists in every week it
    // must cover; with forward echoes that means the event starts no later than
    // that first week — week 1, or the configured start date's week (#111, #468).
    const firstRequiredWeekIdx = useMemo(
        () =>
            getFirstRequiredRecurrenceWeekIdx(
                recurrenceStartDate,
                timelineWeeks,
                dateOfDayId,
            ),
        [ recurrenceStartDate, timelineWeeks, dateOfDayId ],
    );
    const recurrenceSatisfied = isRecurrenceSatisfied(
        recurrence,
        currentWeekIdx,
        firstRequiredWeekIdx,
    );

    // Day-view ghosts: days the pattern would have hit, minus the window and
    // minus materialized days, intersected with the skipped set (#469).
    const skippedRecurrenceDayIds = useMemo(() => {
        const pattern = getRecurrenceOccurrenceDayIds({
            recurrence,
            startDayId: currentDayId,
            linearDays,
            dayIndexOf,
            recurrenceStartDate,
            recurrenceEndDate,
            dateOf: dateOfDayId,
            allowedDayIndices,
        });
        const set = new Set<string>();
        pattern.forEach((dayId) => {
            if (skippedDayIds.has(dayId)) set.add(dayId);
        });
        return set;
    }, [
        recurrence,
        currentDayId,
        linearDays,
        dayIndexOf,
        recurrenceStartDate,
        recurrenceEndDate,
        dateOfDayId,
        skippedDayIds,
        allowedDayIndices,
    ]);

    const isDayInWindow = useCallback(
        (dayId: string) =>
            isDayInRecurrenceWindow(dayId, {
                recurrenceStartDate,
                recurrenceEndDate,
                dateOf: dateOfDayId,
            }),
        [ recurrenceStartDate, recurrenceEndDate, dateOfDayId ],
    );

    const firstDayId = timelineWeeks[ 0 ]?.days[ 0 ] ?? null;

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
                violations: myViolations,
                spanInfo,
                relativeDaySizing,
                isRecurring,
                recurrence,
                recurrenceSatisfied,
                currentWeekIdx,
                dayIndexOf,
                excludedDayIds,
                skippedDayIds,
                isDayInWindow,
                weekIndexByDayId,
            })
            : buildDailyEventCells({
                timelineWeeks,
                moduleId,
                eventId,
                eventTitle: event.title,
                currentDayId,
                isEventUnmapped,
                violations: myViolations,
                spanInfo,
                timeLabel,
                isRecurring,
                recurrenceSatisfied,
                recurrenceDayIds,
                skippedRecurrenceDayIds,
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
        skippedDayIds,
        skippedRecurrenceDayIds,
        isDayInWindow,
        weekIndexByDayId,
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
                    isEventUnmapped ? !isRecurring : null
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
