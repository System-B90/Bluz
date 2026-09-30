import dayjs, { Dayjs } from "dayjs";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import {
    getEffectiveWeekSplit,
    getWeekSplitDayIds,
    WeekSplitWeek,
} from "@/api-shared/gantt/week-split";
import {
    GanttCurriculum,
    GanttCurriculumModuleDayMapping,
    GanttDay,
    GanttDayId,
    GanttDayIndex,
    GanttWeek,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";

export type CapacityStatus = "empty" | "error" | "ok" | "warning";

export function clampWorkingMinutes(minutes: number): number {
    if (!Number.isFinite(minutes)) return 0;
    return Math.max(0, Math.min(24 * 60, Math.round(minutes)));
}

export function formatMinutesAsTimeInput(minutes: number): string {
    const clamped = clampWorkingMinutes(minutes);
    const hours = Math.floor(clamped / 60);
    const remainderMinutes = clamped % 60;

    return `${hours.toString().padStart(2, "0")}:${remainderMinutes
        .toString()
        .padStart(2, "0")}`;
}

export function formatMinutesAsDuration(minutes: number): string {
    const total = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
    const hours = Math.floor(total / 60);
    const remainderMinutes = total % 60;

    return `${hours}:${remainderMinutes.toString().padStart(2, "0")}`;
}

export function parseTimeInputToMinutes(value: string): null | number {
    const trimmed = value.trim();
    if (!trimmed) return 0;

    const timeMatch = /^(\d{1,2})(?::([0-5]?\d))?$/.exec(trimmed);
    if (timeMatch) {
        const hours = Number(timeMatch[1]);
        const minutes = Number(timeMatch[2] ?? 0);

        return clampWorkingMinutes(hours * 60 + minutes);
    }

    const decimalHours = Number(trimmed);
    if (!Number.isFinite(decimalHours) || decimalHours < 0) {
        return null;
    }

    return clampWorkingMinutes(decimalHours * 60);
}

export function formatHours(
    minutes: number,
    maximumFractionDigits = 1,
): string {
    return new Intl.NumberFormat("he-IL", {
        maximumFractionDigits,
        minimumFractionDigits: 0,
    }).format(minutes / 60);
}

export function formatHoursLabel(minutes: number): string {
    return `${formatHours(minutes)} ש׳`;
}

export function getWeekTotalMinutes(
    week: GanttWeek | undefined,
    state: NormalizedStore,
): number {
    return (week?.days ?? []).reduce((total, dayId) => {
        return total + (state.days[dayId]?.totalWorkingMinutes ?? 0);
    }, 0);
}

export function getCurriculumTotalWorkingMinutes(
    curriculum: GanttCurriculum | undefined,
    state: NormalizedStore,
): number {
    return (curriculum?.weeks ?? []).reduce((total, weekId) => {
        return total + getWeekTotalMinutes(state.weeks[weekId], state);
    }, 0);
}

export function getCourseStartDay(startDate: null | string): Dayjs | null {
    if (!startDate) return null;

    const parsed = dayjs(startDate);

    return parsed.isValid() ? parsed.startOf("day") : null;
}

export function getDayDate(
    startDate: null | string,
    weekIndex: number,
    dayIndex: GanttDayIndex,
): Dayjs | null {
    const startDay = getCourseStartDay(startDate);
    if (!startDay) return null;

    return startDay.add(weekIndex * 7 + dayIndex, "day");
}

export function getWeekDateRange(
    startDate: null | string,
    weekIndex: number,
): { end: Dayjs; start: Dayjs } | null {
    const start = getDayDate(startDate, weekIndex, GanttDayIndex.Sunday);
    if (!start) return null;

    return { start, end: start.add(6, "day") };
}

export function formatShortDate(date: Dayjs): string {
    return date.format("D.M");
}

export function formatWeekDateRange(
    range: { end: Dayjs; start: Dayjs } | null,
): string {
    if (!range) return "";

    return `${formatShortDate(range.start)}-${formatShortDate(range.end)}`;
}

export function getCourseEndDate(
    startDate: null | string,
    weekCount: number,
): Dayjs | null {
    const startDay = getCourseStartDay(startDate);
    if (!startDay || weekCount <= 0) return startDay;

    return startDay.add(weekCount * 7 - 1, "day");
}

// ---------------------------------------------------------------------------
// O(1) day/week index lookups (issue #159)
// ---------------------------------------------------------------------------

/** Maps each dayId to its position within a flattened list of days. */
export function buildDayIndexMap(
    linearDays: Array<GanttDayId>,
): Map<GanttDayId, number> {
    const map = new Map<GanttDayId, number>();
    linearDays.forEach((dayId, idx) => map.set(dayId, idx));
    return map;
}

/** Maps each dayId to the index of the week (within timelineWeeks) that owns it. */
export function buildWeekIndexByDayId(
    timelineWeeks: Array<GanttWeek>,
): Map<GanttDayId, number> {
    const map = new Map<GanttDayId, number>();
    timelineWeeks.forEach((week, weekIdx) => {
        week.days.forEach((dayId) => map.set(dayId, weekIdx));
    });
    return map;
}

// ---------------------------------------------------------------------------
// Multi-day spanning events (issue #105)
// ---------------------------------------------------------------------------

export type EventDaySpan = {
    /** Day ids the event occupies, starting at its mapped day. */
    dayIds: Array<GanttDayId>;
    /** Minutes consumed on each spanned day (parallel to `dayIds`). */
    minutesPerDay: Array<number>;
    /** True when the event overflows its start day onto subsequent day(s). */
    spillover: boolean;
    /**
     * True when the event's hours are split over consecutive weeks (#768):
     * `dayIds` are then one day per week, not a contiguous run.
     */
    weekSplit?: boolean;
};

/** Groups the ordered timeline days back into their weeks. */
function groupDaysByWeek(
    linearDays: Array<GanttDayId>,
    state: NormalizedStore,
): Array<WeekSplitWeek> {
    const weekIdByDay = new Map<GanttDayId, string>();
    for (const week of Object.values(state.weeks)) {
        for (const dayId of week.days) weekIdByDay.set(dayId, week.id);
    }
    const weeks: Array<WeekSplitWeek> = [];
    let lastWeekId: string | undefined;
    for (const dayId of linearDays) {
        const weekId = weekIdByDay.get(dayId);
        if (weeks.length === 0 || weekId !== lastWeekId) weeks.push({ days: [] });
        weeks[weeks.length - 1].days.push(dayId);
        lastWeekId = weekId;
    }
    return weeks;
}

/**
 * What an event may still use of a day, given everything already placed on
 * it. Without one, an event sees the day's whole working capacity.
 */
export type DayHeadroom = {
    /** Minutes `eventId` can still add on `dayId` without overfilling it. */
    headroom: (dayId: GanttDayId, eventId: string, capacity: number) => number;
    /** Records that `eventId` uses `minutes` of `dayId`. */
    consume: (dayId: GanttDayId, eventId: string, minutes: number) => void;
};

/**
 * Computes, per mapped event, the days it actually occupies. An event whose
 * required minutes exceed its start day's working capacity dynamically
 * overflows the excess onto subsequent days. The database still stores only
 * the start-day mapping — this is a pure frontend layout computation.
 *
 * With `load`, capacity is what is left for the event's own students rather
 * than the whole day, and events are laid out in timeline order so earlier
 * placements fill a day first.
 */
export function computeEventDaySpans({
    mappings,
    state,
    linearDays,
    load,
}: {
    mappings: Record<string, GanttCurriculumModuleDayMapping>;
    state: NormalizedStore;
    linearDays: Array<GanttDayId>;
    load?: DayHeadroom;
}): Record<string, EventDaySpan> {
    const spans: Record<string, EventDaySpan> = {};
    let weeks: Array<WeekSplitWeek> | undefined;
    const dayOrder = buildDayIndexMap(linearDays);
    const ordered = Object.values(mappings).sort(
        (a, b) =>
            (dayOrder.get(a.dayId) ?? 0) - (dayOrder.get(b.dayId) ?? 0) ||
            a.sortOrder - b.sortOrder,
    );
    const record = (eventId: string, span: EventDaySpan) => {
        spans[eventId] = span;
        span.dayIds.forEach((dayId, i) =>
            load?.consume(dayId, eventId, span.minutesPerDay[i]),
        );
    };

    for (const mapping of ordered) {
        if (!mapping.eventId || spans[mapping.eventId]) continue;
        const event = state.events[mapping.eventId];
        if (!event) continue;
        const startIdx = linearDays.indexOf(mapping.dayId);
        if (startIdx === -1) continue;

        // Human-defined split over consecutive weeks (#768): one part per
        // week, no day-capacity overflow.
        const split = getEffectiveWeekSplit(
            event.splitAcrossWeeks,
            mapping.weekSplitMinutes,
            event.minimumDuration ?? 0,
        );
        if (split) {
            weeks ??= groupDaysByWeek(linearDays, state);
            const splitDayIds = getWeekSplitDayIds(mapping.dayId, split.length, weeks);
            const minutesPerDay = split.slice(0, splitDayIds.length);
            // Parts past the timeline's end are parked on its last week.
            minutesPerDay[minutesPerDay.length - 1] += split
                .slice(splitDayIds.length)
                .reduce((sum, part) => sum + part, 0);
            record(mapping.eventId, {
                dayIds: splitDayIds,
                minutesPerDay,
                spillover: false,
                weekSplit: true,
            });
            continue;
        }

        const dayIds: Array<GanttDayId> = [];
        const minutesPerDay: Array<number> = [];
        let remaining = event.minimumDuration ?? 0;
        let idx = startIdx;

        while (idx < linearDays.length) {
            const dayId = linearDays[idx];
            const dayCapacity = state.days[dayId]?.totalWorkingMinutes ?? 0;
            const capacity = load
                ? Math.max(0, load.headroom(dayId, mapping.eventId, dayCapacity))
                : dayCapacity;
            const isStartDay = dayIds.length === 0;

            // Days with no room left can't host hours; skip them mid-span. The
            // start day always hosts (a 0-capacity start absorbs everything,
            // matching the pre-spillover behavior; a start day that is merely
            // full keeps its place and spills everything onward).
            if (capacity > 0 || isStartDay) {
                const consumed =
                    capacity > 0 || dayCapacity > 0
                        ? Math.min(remaining, capacity)
                        : remaining;
                dayIds.push(dayId);
                minutesPerDay.push(consumed);
                remaining -= consumed;
            }
            if (remaining <= 0) break;
            idx += 1;
        }

        if (remaining > 0 && minutesPerDay.length > 0) {
            // Timeline ended mid-overflow: park the leftover on the last day.
            minutesPerDay[minutesPerDay.length - 1] += remaining;
        }
        if (dayIds.length > 0) {
            record(mapping.eventId, {
                dayIds,
                minutesPerDay,
                spillover: dayIds.length > 1,
            });
        }
    }

    return spans;
}

export function getCapacityStatus(
    availableMinutes: number,
    scheduledMinutes: number,
): CapacityStatus {
    if (scheduledMinutes > availableMinutes) return "error";
    if (scheduledMinutes === 0) return "empty";
    if (availableMinutes === 0) return "error";
    if (scheduledMinutes / availableMinutes >= 0.9) return "warning";

    return "ok";
}

/**
 * Severity of a week's over-allocation, for the weeks-view week header (#467).
 *
 * A single day spilling over its own hours is recoverable — the work can move
 * to another day in the same week — so it is amber. Red is reserved for the
 * case that no reshuffle can fix: the week needs more hours than it has in
 * total. `null` means no day is over its capacity at all.
 */
export function getWeekOverAllocationSeverity(
    days: ReadonlyArray<{ availableMinutes: number; scheduledMinutes: number }>,
): "error" | "warning" | null {
    const hasOverloadedDay = days.some(
        (day) => day.scheduledMinutes > day.availableMinutes,
    );
    if (!hasOverloadedDay) return null;

    const sum = (pick: (day: (typeof days)[number]) => number) =>
        days.reduce((total, day) => total + pick(day), 0);

    return sum((day) => day.scheduledMinutes) > sum((day) => day.availableMinutes)
        ? "error"
        : "warning";
}

export function getSaturdayForWeek(
    week: GanttWeek | undefined,
    state: NormalizedStore,
): (GanttDay & { id: GanttDayId; weekId: GanttWeekId }) | undefined {
    const saturdayId = week?.days.find(
        (dayId) => state.days[dayId]?.dayIndex === GanttDayIndex.Saturday,
    );

    return saturdayId ? state.days[saturdayId] : undefined;
}
