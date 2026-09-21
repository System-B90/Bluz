import { getDayNameDisplay, GanttDayIndex } from "@/api-shared/types/gantt/models";
import { formatHours } from "@/components/gantt/curriculum-view/gantt-time-utils";

export function percent(part: number, whole: number): number {
    return whole > 0 ? Math.round((100 * part) / whole) : 0;
}

export function hours(minutes: number): string {
    return `${formatHours(minutes)} שעות`;
}

export function dayLabel(weekNumber: number, dayIndex: GanttDayIndex): string {
    return `שבוע ${weekNumber}, ${getDayNameDisplay(dayIndex)}`;
}

/** Counts items per key, sorted by descending count. */
export function countBy<T>(items: Iterable<T>, keyOf: (item: T) => null | string | undefined): Array<[string, number]> {
    const counts = new Map<string, number>();
    for (const item of items) {
        const key = keyOf(item);
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [ ...counts.entries() ].sort((a, b) => b[1] - a[1]);
}

/** Sums a value per key, sorted by descending total. */
export function sumBy<T>(
    items: Iterable<T>,
    keyOf: (item: T) => null | string | undefined,
    valueOf: (item: T) => number,
): Array<[string, number]> {
    const totals = new Map<string, number>();
    for (const item of items) {
        const key = keyOf(item);
        if (key) totals.set(key, (totals.get(key) ?? 0) + valueOf(item));
    }
    return [ ...totals.entries() ].sort((a, b) => b[1] - a[1]);
}

export function pluralize(count: number, one: string, many: string): string {
    return count === 1 ? one : `${count} ${many}`;
}
