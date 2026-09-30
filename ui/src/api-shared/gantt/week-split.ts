/**
 * Splitting one event's hours across consecutive weeks (#768).
 *
 * An event flagged `splitAcrossWeeks` may carry, on its curriculum mapping, a
 * human-defined list of minutes per week: `[180, 180, 240]` runs 3h in the
 * mapped week, 3h the week after and 4h the one after that. Each part lands on
 * the same position within its week as the mapped day, so moving the event
 * moves every part with it. Shared by the gantt layout and the cut planner.
 */

/** Minimal week shape: the day ids in display order. */
export type WeekSplitWeek = { days: Array<string> };

/**
 * True when `parts` is a usable split: at least two positive whole-minute
 * parts. The sum is not checked here — see `isWeekSplitComplete`.
 */
export function isWeekSplitMinutes(parts: unknown): parts is Array<number> {
    return (
        Array.isArray(parts) &&
        parts.every((part) => Number.isInteger(part) && part > 0)
    );
}

/** True when a split's parts add up to the event's whole duration. */
export function isWeekSplitComplete(
    parts: Array<number>,
    totalMinutes: number,
): boolean {
    return (
        parts.length >= 2 &&
        parts.reduce((sum, part) => sum + part, 0) === totalMinutes
    );
}

/**
 * The split to apply, or null to run the event whole: only a flagged event
 * with a complete split is split.
 */
export function getEffectiveWeekSplit(
    splitAcrossWeeks: boolean | undefined,
    parts: Array<number> | null | undefined,
    totalMinutes: number,
): Array<number> | null {
    if (!splitAcrossWeeks || !parts) return null;
    return isWeekSplitComplete(parts, totalMinutes) ? parts : null;
}

/**
 * The day each part runs on: the mapped day's position, repeated in each
 * following week (clamped to shorter weeks). Parts past the timeline's end are
 * dropped, so the result may be shorter than the split.
 */
export function getWeekSplitDayIds(
    startDayId: string,
    partCount: number,
    weeks: Array<WeekSplitWeek>,
): Array<string> {
    const startWeekIdx = weeks.findIndex((week) =>
        week.days.includes(startDayId),
    );
    if (startWeekIdx === -1) return [];
    const position = weeks[startWeekIdx].days.indexOf(startDayId);

    const dayIds: Array<string> = [];
    for (let i = 0; i < partCount; i++) {
        const week = weeks[startWeekIdx + i];
        if (!week || week.days.length === 0) break;
        dayIds.push(week.days[Math.min(position, week.days.length - 1)]);
    }
    return dayIds;
}
