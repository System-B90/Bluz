import React from "react";

import { GanttWeek } from "@/api-shared/types/gantt/models";
import { GanttCell } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttCell";

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
    } = params;

    return timelineWeeks.map((week, weekIdx) => {
        const firstDayId = week.days[ 0 ];

        const isExplicitlyMappedHere = currentDayId
            ? week.days.includes(currentDayId)
            : false;
        const isWaitingInModuleStartColumn =
            isEventUnmapped &&
            isModuleMapped &&
            weekIdx === moduleStartWeekIdx;
        const hasBlock = isExplicitlyMappedHere || isWaitingInModuleStartColumn;

        const blockPayload = isExplicitlyMappedHere
            ? { type: "event-move", moduleId, eventId, sourceDayId: currentDayId }
            : { type: "event-map", moduleId, eventId };

        const blockId = isExplicitlyMappedHere
            ? `drag-event-${eventId}-${currentDayId}`
            : `drag-event-staged-${eventId}`;

        let blockLeftPx: number | undefined;
        let blockWidthPx: number | undefined;
        if (isExplicitlyMappedHere && currentDayId)
        {
            const CELL = 80;
            const dayPosInWeek = week.days.indexOf(currentDayId);
            const startFrac = dayPosInWeek / week.days.length;
            let endFrac = (dayPosInWeek + 1) / week.days.length;
            let weekSpan = 0;

            // Multi-day spillover: stretch the block to the last spanned day,
            // possibly across week boundaries (#105).
            if (spanInfo)
            {
                const endWeekIdx = timelineWeeks.findIndex((w) =>
                    w.days.includes(spanInfo.endDayId),
                );
                if (endWeekIdx >= weekIdx)
                {
                    const endWeek = timelineWeeks[ endWeekIdx ];
                    endFrac =
                        (endWeek.days.indexOf(spanInfo.endDayId) + 1) /
                        endWeek.days.length;
                    weekSpan = endWeekIdx - weekIdx;
                }
            }

            blockLeftPx = Math.round(startFrac * CELL) + 2;
            blockWidthPx = Math.max(
                Math.round(weekSpan * CELL + (endFrac - startFrac) * CELL) - 4,
                16,
            );
        }

        return (
            <GanttCell
                blockId={ blockId }
                blockLeftPx={ isExplicitlyMappedHere ? blockLeftPx : undefined }
                blockPayload={ blockPayload }
                blockTitle={ eventTitle }
                blockWidthPx={
                    isExplicitlyMappedHere ? blockWidthPx : undefined
                }
                dayId={ firstDayId }
                dropId={ `drop-event-${eventId}-${firstDayId}` }
                elementId={ hasBlock ? `block-event-${eventId}` : undefined }
                hasBlock={ hasBlock }
                isAbsoluteBlock={ true }
                isOpaque={ isWaitingInModuleStartColumn }
                isSpillover={ isExplicitlyMappedHere && !!spanInfo }
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
    } = params;

    return timelineWeeks.flatMap((week) =>
        week.days.map((dayId) => {
            const isExplicitlyMappedHere = currentDayId === dayId;
            const isWaitingInModuleStartColumn =
                isEventUnmapped &&
                isModuleMapped &&
                moduleStartDayId === dayId;
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
                    blockId={ blockId }
                    blockPayload={ blockPayload }
                    blockTitle={ eventTitle }
                    dayId={ dayId }
                    dropId={ `drop-event-${eventId}-${dayId}` }
                    elementId={
                        hasBlock ? `block-event-${eventId}` : undefined
                    }
                    hasBlock={ hasBlock }
                    isAbsoluteBlock={ true }
                    isOpaque={ isWaitingInModuleStartColumn }
                    isSpillover={ isExplicitlyMappedHere && !!spanInfo }
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
