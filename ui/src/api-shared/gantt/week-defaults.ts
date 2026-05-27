import { GanttDayIndex } from "@/api-shared/types/gantt/models";

const DEFAULT_WEEKDAY_HOURS_FALLBACK = 8;
const DEFAULT_FRIDAY_HOURS_FALLBACK = 6;

function parseDefaultHours(rawValue: string | undefined, fallback: number): number {
    if (!rawValue) return fallback;

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;

    return parsed;
}

export function getDefaultWorkingMinutesForDay(dayIndex: GanttDayIndex): number {
    if (dayIndex === GanttDayIndex.Saturday) {
        return 0;
    }

    const fallbackHours =
    dayIndex === GanttDayIndex.Friday
        ? DEFAULT_FRIDAY_HOURS_FALLBACK
        : DEFAULT_WEEKDAY_HOURS_FALLBACK;

    const envKey =
    dayIndex === GanttDayIndex.Friday
        ? "NEXT_PUBLIC_GANT_DEFAULT_FRIDAY_HOURS"
        : "NEXT_PUBLIC_GANT_DEFAULT_WEEKDAY_HOURS";

    return Math.round(
        parseDefaultHours(process.env[envKey], fallbackHours) * 60,
    );
}
