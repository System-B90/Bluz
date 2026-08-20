import { EventRecurrence, GanttDayIndex } from "@/api-shared/types/gantt/models";

/**
 * Pure recurrence helpers for the Gantt timeline (#111).
 *
 * A recurring event is placed on a single start day and then "echoes" forward
 * across the timeline: daily events repeat on every following day, weekly events
 * repeat on the same weekday of every following week. The recurrence is only
 * *satisfied* once an occurrence exists in every week of the curriculum — which,
 * given the forward echo, means the event must start in the very first week.
 * Until then an "unallocated" marker is shown in the first column.
 */

export type RecurrenceWindow = {
    /** First date the recurrence may echo onto ("YYYY-MM-DD"), or null. */
    recurrenceStartDate?: null | string;
    /** Last date the recurrence may echo onto ("YYYY-MM-DD"), or null. */
    recurrenceEndDate?: null | string;
    /** Date of a timeline day ("YYYY-MM-DD"), or undefined when unknown. */
    dateOf?: (dayId: string) => string | undefined;
};

export type GetRecurrenceOccurrenceDayIdsParams = RecurrenceWindow & {
    recurrence: EventRecurrence;
    /** Day the event is mapped to, or null when unmapped. */
    startDayId: null | string;
    /** Timeline day ids in chronological order. */
    linearDays: Array<string>;
    /** Day-of-week for a day id, or undefined when unknown. */
    dayIndexOf: (dayId: string) => GanttDayIndex | undefined;
    /** Occurrence days to skip — deleted or materialized into their own event. */
    excludedDayIds?: Set<string>;
    /**
     * Weekdays the event's temporal constraints permit it to land on, from
     * {@link getAllowedDayIndices}. `null`/undefined ⇒ unrestricted. An echo
     * whose weekday isn't in this set is skipped rather than forced (#111
     * follow-up): a recurring event only recurs on its valid days.
     */
    allowedDayIndices?: Set<GanttDayIndex> | null;
};

/**
 * Whether a timeline day falls inside an event's configured recurrence window
 * (#468). A missing bound is open-ended, and a day whose date cannot be
 * resolved is let through rather than silently dropped — the window is a
 * restriction on top of the echo, not a second source of truth for it.
 * Dates are "YYYY-MM-DD", so lexicographic comparison is chronological.
 */
export function isDayInRecurrenceWindow(
    dayId: string,
    { recurrenceStartDate, recurrenceEndDate, dateOf }: RecurrenceWindow,
): boolean {
    if (!recurrenceStartDate && !recurrenceEndDate) return true;

    const date = dateOf?.(dayId);
    if (!date) return true;

    if (recurrenceStartDate && date < recurrenceStartDate) return false;
    if (recurrenceEndDate && date > recurrenceEndDate) return false;

    return true;
}

/**
 * The day ids a recurring event echoes onto, excluding its start day and any
 * excepted days (deleted occurrences or occurrences materialized into their
 * own standalone event).
 * Returns an empty set for non-recurring or unmapped events.
 */
export function getRecurrenceOccurrenceDayIds({
    recurrence,
    startDayId,
    linearDays,
    dayIndexOf,
    excludedDayIds,
    recurrenceStartDate,
    recurrenceEndDate,
    dateOf,
    allowedDayIndices,
}: GetRecurrenceOccurrenceDayIdsParams): Set<string> {
    const ids = new Set<string>();
    if (recurrence === EventRecurrence.None || !startDayId) return ids;

    const startIdx = linearDays.indexOf(startDayId);
    if (startIdx === -1) return ids;

    const startDow = dayIndexOf(startDayId);
    for (let i = startIdx + 1; i < linearDays.length; i++) {
        const dayId = linearDays[ i ];
        if (excludedDayIds?.has(dayId)) continue;
        if (
            !isDayInRecurrenceWindow(dayId, {
                recurrenceStartDate,
                recurrenceEndDate,
                dateOf,
            })
        ) {
            continue;
        }
        const dow = dayIndexOf(dayId);
        if (allowedDayIndices && dow !== undefined && !allowedDayIndices.has(dow)) {
            continue;
        }
        if (recurrence === EventRecurrence.Daily) {
            ids.add(dayId);
        } else if (recurrence === EventRecurrence.Weekly) {
            if (dow !== undefined && startDow !== undefined && dow === startDow) {
                ids.add(dayId);
            }
        }
    }
    return ids;
}

/**
 * The actual occurrence day within a given week's days for a weekly-recurring
 * event — the day matching the start day's weekday. The weekly timeline view
 * anchors an occurrence's visual block to the week's first day, but delete/
 * materialize actions need the real day id the occurrence falls on.
 */
export function getOccurrenceDayIdForWeek(
    weekDayIds: Array<string>,
    startDow: GanttDayIndex | undefined,
    dayIndexOf: (dayId: string) => GanttDayIndex | undefined,
): null | string {
    if (startDow === undefined) return null;
    return weekDayIds.find((dayId) => dayIndexOf(dayId) === startDow) ?? null;
}

/**
 * Whether a recurring event's obligation is met: an occurrence exists in every
 * week the recurrence is supposed to cover. Since occurrences echo forward from
 * the start week, this holds exactly when the event starts on or before the
 * first required week — week 0 by default, or the week holding the configured
 * recurrence start date when one is set (#468).
 * Unmapped events (`startWeekIdx < 0`) are never satisfied. Non-recurring events
 * carry no obligation and are always considered satisfied.
 */
export function isRecurrenceSatisfied(
    recurrence: EventRecurrence,
    startWeekIdx: number,
    firstRequiredWeekIdx: number = 0,
): boolean {
    if (recurrence === EventRecurrence.None) return true;
    if (startWeekIdx < 0) return false;
    return startWeekIdx <= Math.max(firstRequiredWeekIdx, 0);
}

/**
 * Index of the first timeline week the recurrence must cover, given its
 * configured start date (#468). Returns 0 when there is no start date or it
 * cannot be resolved to a week, preserving the "must start in week 1" rule.
 */
export function getFirstRequiredRecurrenceWeekIdx(
    recurrenceStartDate: null | string | undefined,
    weeks: ReadonlyArray<{ days: ReadonlyArray<string> }>,
    dateOf: (dayId: string) => string | undefined,
): number {
    if (!recurrenceStartDate) return 0;

    const idx = weeks.findIndex((week) =>
        week.days.some((dayId) => {
            const date = dateOf(dayId);
            return !!date && date >= recurrenceStartDate;
        }),
    );

    return idx === -1 ? 0 : idx;
}
