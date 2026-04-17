import { CurriculumDay, DAY_NAME_DISPLAY, DayIndex } from '@/api-shared/types/gant/curriculum';

const DEFAULT_WEEKDAY_HOURS_FALLBACK = 8;
const DEFAULT_FRIDAY_HOURS_FALLBACK = 6;

export const defaultWeekDayOrder: DayIndex[] = [
    DayIndex.Sunday,
    DayIndex.Monday,
    DayIndex.Tuesday,
    DayIndex.Wednesday,
    DayIndex.Thursday,
    DayIndex.Friday,
];

function parseDefaultHours(rawValue: string | undefined, fallback: number): number
{
    if (!rawValue) return fallback;

    const parsed = Number(rawValue);
    if (Number.isNaN(parsed) || parsed < 0) return fallback;
    return parsed;
}

export const defaultWeekdayHours = parseDefaultHours(
    process.env.NEXT_PUBLIC_GANT_DEFAULT_WEEKDAY_HOURS,
    DEFAULT_WEEKDAY_HOURS_FALLBACK
);

export const defaultFridayHours = parseDefaultHours(
    process.env.NEXT_PUBLIC_GANT_DEFAULT_FRIDAY_HOURS,
    DEFAULT_FRIDAY_HOURS_FALLBACK
);

export function buildDefaultWeekDays(): Partial<CurriculumDay>[]
{
    return defaultWeekDayOrder.map((dayName) => ({
        title: DAY_NAME_DISPLAY[dayName],
        day: dayName,
        totalWorkingHours: dayName === DayIndex.Friday ? defaultFridayHours : defaultWeekdayHours,
        comment: '',
    }));
}
