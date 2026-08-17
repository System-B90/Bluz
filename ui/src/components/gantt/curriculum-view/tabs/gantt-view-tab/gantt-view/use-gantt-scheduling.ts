import { useCallback, useMemo } from "react";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { getRecurrenceOccurrenceDayIds } from "@/api-shared/gantt/recurrence";
import { EventRecurrence, GanttCurriculumModuleDayMapping } from "@/api-shared/types/gantt/models";
import { computeEventDaySpans, getSpilloverMinutesByDay } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { GanttRecurrenceExceptionState } from "@/components/gantt/state/recurrence-exceptions/types";

// Multi-day spillover layout (which days each mapped event actually
// occupies) plus per-day scheduled minutes, including recurring-event
// echoes onto days that have no mapping row of their own (#105).
export const useGanttScheduling = ({
    curriculumMappings,
    dateOfDayId,
    eventMappings,
    linearDays,
    recurrenceExceptionState,
    state,
}: {
    curriculumMappings: Record<string, GanttCurriculumModuleDayMapping>;
    /** Calendar date of a day, for the recurrence window (#468). */
    dateOfDayId: (dayId: string) => string | undefined;
    eventMappings: Record<string, string>;
    linearDays: Array<string>;
    recurrenceExceptionState: GanttRecurrenceExceptionState;
    state: NormalizedStore;
}) =>
{
    const eventSpans = useMemo(
        () =>
            computeEventDaySpans({
                mappings: curriculumMappings,
                state,
                linearDays,
            }),
        [ curriculumMappings, state, linearDays ],
    );

    const dayIndexOf = useCallback(
        (dayId: string) => state.days[ dayId ]?.dayIndex,
        [ state.days ],
    );

    const recurrenceMinutesByDay = useMemo(() =>
    {
        const byDay: Record<string, number> = {};
        Object.entries(eventMappings).forEach(([ eventId, startDayId ]) =>
        {
            const event = state.events[ eventId ];
            if (!event || event.recurrence === EventRecurrence.None) return;

            const excludedDayIds = new Set<string>();
            Object.values(recurrenceExceptionState.exceptions).forEach((e) =>
            {
                if (e.eventId === eventId) excludedDayIds.add(e.dayId);
            });

            const occurrenceDayIds = getRecurrenceOccurrenceDayIds({
                recurrence: event.recurrence,
                startDayId,
                linearDays,
                dayIndexOf,
                excludedDayIds,
                recurrenceStartDate: event.recurrenceStartDate,
                recurrenceEndDate: event.recurrenceEndDate,
                dateOf: dateOfDayId,
            });

            occurrenceDayIds.forEach((dayId) =>
            {
                byDay[ dayId ] = (byDay[ dayId ] ?? 0) + (event.minimumDuration ?? 0);
            });
        });
        return byDay;
    }, [
        eventMappings,
        state.events,
        recurrenceExceptionState.exceptions,
        linearDays,
        dayIndexOf,
        dateOfDayId,
    ]);

    const scheduledMinutesByDay = useMemo(() =>
    {
        const merged = getSpilloverMinutesByDay(eventSpans);
        Object.entries(recurrenceMinutesByDay).forEach(([ dayId, minutes ]) =>
        {
            merged[ dayId ] = (merged[ dayId ] ?? 0) + minutes;
        });
        return merged;
    }, [ eventSpans, recurrenceMinutesByDay ]);

    return { eventSpans, scheduledMinutesByDay };
};
