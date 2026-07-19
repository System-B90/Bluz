import React from "react";

import { getOccurrenceDayIdForWeek } from "@/api-shared/gantt/recurrence";
import {
    EventRecurrence,
    GanttDayIndex,
    GanttWeek,
} from "@/api-shared/types/gantt/models";
import { GanttCell } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttCell";
import { GanttBlockPayload } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";

/** Multi-day spillover info for a mapped event (#105). */
export type EventSpanInfo = {
    /** Last day the event occupies (after overflow). */
    endDayId: string;
    /** Total days covered from start to end, inclusive. */
    spanDayCount: number;
};

type WeeklyCellsParams = {
    timelineWeeks: Array<GanttWeek>;
    moduleId: string;
    eventId: string;
    eventTitle?: string;
    currentDayId: null | string;
    isEventUnmapped: boolean;
    isModuleMapped: boolean;
    moduleStartWeekIdx: number;
    violations: Array<string>;
    spanInfo?: EventSpanInfo | null;
    relativeDaySizing: boolean;
    /** Recurring event (daily/weekly). Drives repeat blocks + first-column staging (#111). */
    isRecurring: boolean;
    /** Recurrence cadence, used to resolve the real occurrence day per week. */
    recurrence: EventRecurrence;
    /** Whether every week already holds an occurrence — hides the first-column marker (#111). */
    recurrenceSatisfied: boolean;
    /** Index of the week holding the event's mapped start day, or -1 when unmapped (#111). */
    currentWeekIdx: number;
    /** Day-of-week for a day id, or undefined when unknown. */
    dayIndexOf: (dayId: string) => GanttDayIndex | undefined;
    /** Occurrence days deleted or materialized into a standalone event. */
    excludedDayIds: Set<string>;
    /** O(1) lookup of a dayId's owning week index within timelineWeeks (#159). */
    weekIndexByDayId: Map<string, number>;
};

export function buildWeeklyEventCells(
    params: WeeklyCellsParams,
): Array<React.ReactElement> {
    const {
        timelineWeeks,
        moduleId,
        eventId,
        eventTitle,
        currentDayId,
        isEventUnmapped,
        isModuleMapped,
        moduleStartWeekIdx,
        violations,
        spanInfo,
        relativeDaySizing,
        isRecurring,
        recurrence,
        recurrenceSatisfied,
        currentWeekIdx,
        dayIndexOf,
        excludedDayIds,
        weekIndexByDayId,
    } = params;

    const startDow = currentDayId ? dayIndexOf(currentDayId) : undefined;

    return timelineWeeks.map((week, weekIdx) => {
        const firstDayId = week.days[ 0 ];

        const isExplicitlyMappedHere = currentDayId
            ? week.days.includes(currentDayId)
            : false;

        // The real occurrence day within this week (weekday match for weekly
        // recurrence; any day works for daily since it recurs every day).
        const weekOccurrenceDayId =
            recurrence === EventRecurrence.Weekly
                ? getOccurrenceDayIdForWeek(week.days, startDow, dayIndexOf)
                : firstDayId;

        // Recurring event: echo the start block into every following week (#111).
        const isRecurrenceWeek =
            isRecurring &&
            !isExplicitlyMappedHere &&
            currentWeekIdx !== -1 &&
            weekIdx > currentWeekIdx &&
            !(weekOccurrenceDayId && excludedDayIds.has(weekOccurrenceDayId));

        // Recurrence not yet satisfied ⇒ an "unallocated" marker sits in the
        // first column. Draggable staging when unmapped; a non-interactive cue
        // when the event is mapped but doesn't cover every week (#111).
        const isRecurrenceReminder =
            isRecurring &&
            !recurrenceSatisfied &&
            !isExplicitlyMappedHere &&
            weekIdx === 0;
        const reminderIsStaged = isRecurrenceReminder && isEventUnmapped;
        const reminderIsMarker = isRecurrenceReminder && !isEventUnmapped;

        // Non-recurring events keep waiting in their module's start column.
        const isModuleWaiting =
            isEventUnmapped &&
            !isRecurring &&
            isModuleMapped &&
            weekIdx === moduleStartWeekIdx;
        const isOpaqueBlock = reminderIsStaged || reminderIsMarker || isModuleWaiting;
        const ownsAnchor = isExplicitlyMappedHere || reminderIsStaged || isModuleWaiting;

        const hasBlock =
            isExplicitlyMappedHere ||
            isRecurrenceWeek ||
            isRecurrenceReminder ||
            isModuleWaiting;

        const blockPayload: GanttBlockPayload = isExplicitlyMappedHere
            ? { type: "event-move", moduleId, eventId, sourceDayId: currentDayId! }
            : isRecurrenceWeek
                ? { type: "event-occurrence", moduleId, eventId, dayId: weekOccurrenceDayId! }
                : reminderIsMarker
                    ? { moduleId, eventId }
                    : { type: "event-map", moduleId, eventId };

        const blockId = isExplicitlyMappedHere
            ? `drag-event-${eventId}-${currentDayId}`
            : isRecurrenceWeek
                ? `recur-event-${eventId}-${week.id}`
                : reminderIsMarker
                    ? `recur-staged-${eventId}-${week.id}`
                    : `drag-event-staged-${eventId}`;

        // Positioned as percentages of the anchor cell's own width — week
        // columns render wider than their nominal size (the table stretches
        // fixed-width columns to fill the container), so pixel math would
        // undershoot the real span (#118).
        let blockLeftPercent: number | undefined;
        let blockWidthPercent: number | undefined;
        if (isExplicitlyMappedHere && currentDayId)
        {
            const dayPosInWeek = week.days.indexOf(currentDayId);
            const startFrac = relativeDaySizing
                ? dayPosInWeek / week.days.length
                : 0;
            let endFrac = relativeDaySizing
                ? (dayPosInWeek + 1) / week.days.length
                : 1;
            let weekSpan = 0;

            // Multi-day spillover: stretch the block to the last spanned day,
            // possibly across week boundaries (#105).
            if (spanInfo)
            {
                const endWeekIdx = weekIndexByDayId.get(spanInfo.endDayId) ?? -1;
                if (endWeekIdx >= weekIdx)
                {
                    const endWeek = timelineWeeks[ endWeekIdx ];
                    endFrac =
                        (endWeek.days.indexOf(spanInfo.endDayId) + 1) /
                        endWeek.days.length;
                    weekSpan = endWeekIdx - weekIdx;
                }
            }

            blockLeftPercent = startFrac * 100;
            blockWidthPercent = Math.max(
                weekSpan * 100 + (endFrac - startFrac) * 100,
                5,
            );
        }

        return (
            <GanttCell
                blockId={ blockId }
                blockLeftPercent={ isExplicitlyMappedHere ? blockLeftPercent : undefined }
                blockPayload={ blockPayload }
                blockTitle={ eventTitle }
                blockWidthPercent={
                    isExplicitlyMappedHere ? blockWidthPercent : undefined
                }
                dayId={ firstDayId }
                dropId={ `drop-event-${eventId}-${firstDayId}` }
                elementId={
                    ownsAnchor ? `block-event-${eventId}` : undefined
                }
                hasBlock={ hasBlock }
                isAbsoluteBlock={ true }
                isOpaque={ isOpaqueBlock }
                isRecurrence={ isRecurrenceWeek || reminderIsMarker }
                isSpillover={ Boolean(isExplicitlyMappedHere && spanInfo) }
                key={ `week-${week.id}-${eventId}` }
                payloadData={ {
                    targetType: "event",
                    eventId,
                    dayId: firstDayId,
                } }
                violations={ hasBlock ? violations : undefined }
            />
        );
    });
}

type DailyCellsParams = {
    timelineWeeks: Array<GanttWeek>;
    moduleId: string;
    eventId: string;
    eventTitle?: string;
    currentDayId: null | string;
    isEventUnmapped: boolean;
    isModuleMapped: boolean;
    moduleStartDayId: null | string;
    violations: Array<string>;
    spanInfo?: EventSpanInfo | null;
    /** Required-time label shown on the mapped block (zoomed single-week day view). */
    timeLabel?: string;
    /** Recurring event (daily/weekly). Drives repeat blocks + first-column staging (#111). */
    isRecurring: boolean;
    /** Whether every week already holds an occurrence — hides the first-column marker (#111). */
    recurrenceSatisfied: boolean;
    /** Days a recurring event repeats onto, excluding its start day and excepted days (#111). */
    recurrenceDayIds: Set<string>;
    /** First day of the timeline — where an unallocated recurring event is staged (#111). */
    firstDayId: null | string;
};

export function buildDailyEventCells(
    params: DailyCellsParams,
): Array<React.ReactElement> {
    const {
        timelineWeeks,
        moduleId,
        eventId,
        eventTitle,
        currentDayId,
        isEventUnmapped,
        isModuleMapped,
        moduleStartDayId,
        violations,
        spanInfo,
        timeLabel,
        isRecurring,
        recurrenceSatisfied,
        recurrenceDayIds,
        firstDayId,
    } = params;

    return timelineWeeks.flatMap((week) =>
        week.days.map((dayId) => {
            const isExplicitlyMappedHere = currentDayId === dayId;

            // Recurring event: echo the start block onto each recurrence day (#111).
            const isRecurrenceOccurrence =
                isRecurring &&
                !isExplicitlyMappedHere &&
                recurrenceDayIds.has(dayId);

            // Recurrence not yet satisfied ⇒ an "unallocated" marker sits on the
            // first day. Draggable staging when unmapped; a non-interactive cue
            // when the event is mapped but doesn't cover every week (#111).
            const isRecurrenceReminder =
                isRecurring &&
                !recurrenceSatisfied &&
                !isExplicitlyMappedHere &&
                firstDayId === dayId;
            const reminderIsStaged = isRecurrenceReminder && isEventUnmapped;
            const reminderIsMarker = isRecurrenceReminder && !isEventUnmapped;

            // Non-recurring events keep waiting in their module's start column.
            const isModuleWaiting =
                isEventUnmapped &&
                !isRecurring &&
                isModuleMapped &&
                moduleStartDayId === dayId;
            const isOpaqueBlock =
                reminderIsStaged || reminderIsMarker || isModuleWaiting;
            const ownsAnchor =
                isExplicitlyMappedHere || reminderIsStaged || isModuleWaiting;

            const hasBlock =
                isExplicitlyMappedHere ||
                isRecurrenceOccurrence ||
                isRecurrenceReminder ||
                isModuleWaiting;

            const blockPayload: GanttBlockPayload = isExplicitlyMappedHere
                ? { type: "event-move", moduleId, eventId, sourceDayId: dayId }
                : isRecurrenceOccurrence
                    ? { type: "event-occurrence", moduleId, eventId, dayId }
                    : reminderIsMarker
                        ? { moduleId, eventId }
                        : { type: "event-map", moduleId, eventId };

            const blockId = isExplicitlyMappedHere
                ? `drag-event-${eventId}-${dayId}`
                : isRecurrenceOccurrence
                    ? `recur-event-${eventId}-${dayId}`
                    : reminderIsMarker
                        ? `recur-staged-${eventId}-${dayId}`
                        : `drag-event-staged-${eventId}`;

            return (
                <GanttCell
                    blockId={ blockId }
                    blockPayload={ blockPayload }
                    blockTimeLabel={
                        isExplicitlyMappedHere ? timeLabel : undefined
                    }
                    blockTitle={ eventTitle }
                    dayId={ dayId }
                    dropId={ `drop-event-${eventId}-${dayId}` }
                    elementId={
                        ownsAnchor ? `block-event-${eventId}` : undefined
                    }
                    hasBlock={ hasBlock }
                    isAbsoluteBlock={ true }
                    isOpaque={ isOpaqueBlock }
                    isRecurrence={ isRecurrenceOccurrence || reminderIsMarker }
                    isSpillover={ Boolean(isExplicitlyMappedHere && spanInfo) }
                    key={ `${dayId}-${eventId}` }
                    payloadData={ { targetType: "event", eventId, dayId } }
                    spanLength={
                        isExplicitlyMappedHere && spanInfo
                            ? spanInfo.spanDayCount
                            : 1
                    }
                    violations={ hasBlock ? violations : undefined }
                />
            );
        }),
    );
}
