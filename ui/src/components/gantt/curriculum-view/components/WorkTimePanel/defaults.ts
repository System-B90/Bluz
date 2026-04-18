import
{
    DAY_NAME_DISPLAY,
    GanttDay,
    GanttDayIndex,
} from "@/api-shared/types/gantt/models";

const DEFAULT_WEEKDAY_HOURS_FALLBACK = 8;
const DEFAULT_FRIDAY_HOURS_FALLBACK = 6;

export const defaultWeekDayOrder: GanttDayIndex[] = [
    GanttDayIndex.Sunday,
    GanttDayIndex.Monday,
    GanttDayIndex.Tuesday,
    GanttDayIndex.Wednesday,
    GanttDayIndex.Thursday,
    GanttDayIndex.Friday,
];

function parseDefaultHours(
    rawValue: string | undefined,
    fallback: number,
): number {
    if (!rawValue) return fallback;

    const parsed = Number(rawValue);
    if (Number.isNaN(parsed) || parsed < 0) return fallback;
    return parsed;
}

export const defaultWeekdayHours = parseDefaultHours(
    process.env.NEXT_PUBLIC_GANT_DEFAULT_WEEKDAY_HOURS,
    DEFAULT_WEEKDAY_HOURS_FALLBACK,
);

export const defaultFridayHours = parseDefaultHours(
    process.env.NEXT_PUBLIC_GANT_DEFAULT_FRIDAY_HOURS,
    DEFAULT_FRIDAY_HOURS_FALLBACK,
);

export function buildDefaultWeekDays(): Partial<GanttDay>[] {
    return defaultWeekDayOrder.map((dayName) => ({
        title: DAY_NAME_DISPLAY[dayName],
        day: dayName,
        totalWorkingHours:
      dayName === GanttDayIndex.Friday
          ? defaultFridayHours
          : defaultWeekdayHours,
        comment: "",
    }));
}
