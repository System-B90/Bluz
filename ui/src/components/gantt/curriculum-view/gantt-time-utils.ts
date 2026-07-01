import dayjs, { Dayjs } from "dayjs";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import {
    GanttCurriculum,
    GanttCurriculumModuleDayMapping,
    GanttDay,
    GanttDayId,
    GanttDayIndex,
    GanttModuleId,
    GanttWeek,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";
import { calculateMinimumRequiredTimeForModule } from "@/components/gantt/utils";

export type CapacityStatus = "empty" | "error" | "ok" | "warning";

// Tentative time: every module with at least one mapping (whole-module or
// event-level) contributes its full required time, regardless of how many
// of its events are actually allocated. Each module is counted once even if
// mapped across multiple days.
export function getTentativeMinutesForModuleIds({
    mappings,
    moduleIds,
    state,
}: {
    mappings: Record<string, GanttCurriculumModuleDayMapping>;
    moduleIds: Iterable<GanttModuleId>;
    state: NormalizedStore;
}): number {
    const moduleIdsSet = new Set(moduleIds);
    const seen = new Set<GanttModuleId>();
    let total = 0;

    for (const mapping of Object.values(mappings)) {
        if (!moduleIdsSet.has(mapping.moduleId)) continue;
        if (seen.has(mapping.moduleId)) continue;
        seen.add(mapping.moduleId);

        const moduleDoc = state.modules[mapping.moduleId];
        if (moduleDoc) {
            total += calculateMinimumRequiredTimeForModule(moduleDoc, state);
        }
    }

    return total;
}

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

// Allocated time only comes from allocated events, never from a whole-module
// mapping. A module's allocated total is the sum of its own allocated events -
// 0 if none are allocated, partial if only some are. An event mapped across N
// days produces N mapping rows sharing the same eventId; count it once.
function sumUniqueMappedMinutes({
    dayIds,
    mappings,
    state,
}: {
    dayIds: Set<GanttDayId>;
    mappings: Record<string, GanttCurriculumModuleDayMapping>;
    state: NormalizedStore;
}): number {
    const seen = new Set<string>();
    let total = 0;

    for (const mapping of Object.values(mappings)) {
        if (!dayIds.has(mapping.dayId)) continue;
        if (!mapping.eventId) continue;
        if (seen.has(mapping.eventId)) continue;
        seen.add(mapping.eventId);

        total += state.events[mapping.eventId]?.minimumDuration ?? 0;
    }

    return total;
}

export function getScheduledMinutesForDay({
    dayId,
    mappings,
    state,
}: {
    dayId: GanttDayId;
    mappings: Record<string, GanttCurriculumModuleDayMapping>;
    state: NormalizedStore;
}): number {
    return sumUniqueMappedMinutes({ dayIds: new Set([dayId]), mappings, state });
}

export function getWeekScheduledMinutes({
    week,
    mappings,
    state,
}: {
    mappings: Record<string, GanttCurriculumModuleDayMapping>;
    state: NormalizedStore;
    week: GanttWeek | undefined;
}): number {
    return sumUniqueMappedMinutes({
        dayIds: new Set(week?.days ?? []),
        mappings,
        state,
    });
}

export function getCurriculumScheduledMinutes({
    curriculum,
    mappings,
    state,
}: {
    curriculum: GanttCurriculum | undefined;
    mappings: Record<string, GanttCurriculumModuleDayMapping>;
    state: NormalizedStore;
}): number {
    if (!curriculum) return 0;
    const dayIds = new Set<GanttDayId>();
    for (const weekId of curriculum.weeks ?? []) {
        for (const dayId of state.weeks[weekId]?.days ?? []) {
            dayIds.add(dayId);
        }
    }

    return sumUniqueMappedMinutes({ dayIds, mappings, state });
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

export function getSaturdayForWeek(
    week: GanttWeek | undefined,
    state: NormalizedStore,
): (GanttDay & { id: GanttDayId; weekId: GanttWeekId }) | undefined {
    const saturdayId = week?.days.find(
        (dayId) => state.days[dayId]?.dayIndex === GanttDayIndex.Saturday,
    );

    return saturdayId ? state.days[saturdayId] : undefined;
}
