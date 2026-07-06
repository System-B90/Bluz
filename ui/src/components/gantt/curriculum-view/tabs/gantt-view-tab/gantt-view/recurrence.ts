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

export type GetRecurrenceOccurrenceDayIdsParams = {
    recurrence: EventRecurrence;
    /** Day the event is mapped to, or null when unmapped. */
    startDayId: null | string;
    /** Timeline day ids in chronological order. */
    linearDays: Array<string>;
    /** Day-of-week for a day id, or undefined when unknown. */
    dayIndexOf: (dayId: string) => GanttDayIndex | undefined;
};

/**
 * The day ids a recurring event echoes onto, excluding its start day.
 * Returns an empty set for non-recurring or unmapped events.
 */
export function getRecurrenceOccurrenceDayIds({
    recurrence,
    startDayId,
    linearDays,
    dayIndexOf,
}: GetRecurrenceOccurrenceDayIdsParams): Set<string> {
    const ids = new Set<string>();
    if (recurrence === EventRecurrence.None || !startDayId) return ids;

    const startIdx = linearDays.indexOf(startDayId);
    if (startIdx === -1) return ids;

    const startDow = dayIndexOf(startDayId);
    for (let i = startIdx + 1; i < linearDays.length; i++) {
        const dayId = linearDays[ i ];
        if (recurrence === EventRecurrence.Daily) {
            ids.add(dayId);
        } else if (recurrence === EventRecurrence.Weekly) {
            const dow = dayIndexOf(dayId);
            if (dow !== undefined && startDow !== undefined && dow === startDow) {
                ids.add(dayId);
            }
        }
    }
    return ids;
}

/**
 * Whether a recurring event's obligation is met: an occurrence exists in every
 * week of the timeline. Since occurrences echo forward from the start week, this
 * holds exactly when the event starts in the first week (`startWeekIdx === 0`).
 * Unmapped events (`startWeekIdx < 0`) are never satisfied. Non-recurring events
 * carry no obligation and are always considered satisfied.
 */
export function isRecurrenceSatisfied(
    recurrence: EventRecurrence,
    startWeekIdx: number,
): boolean {
    if (recurrence === EventRecurrence.None) return true;
    if (startWeekIdx < 0) return false;
    return startWeekIdx === 0;
}
