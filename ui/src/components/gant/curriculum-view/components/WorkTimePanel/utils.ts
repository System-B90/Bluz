import { CurriculumDay, CurriculumWeek, DayName } from '@/api-shared/types/gant/curriculum';

const dayOrder: DayName[] = [
    DayName.Sunday,
    DayName.Monday,
    DayName.Tuesday,
    DayName.Wednesday,
    DayName.Thursday,
    DayName.Friday,
    DayName.Saturday,
];

export function cloneWeeks(weeks: CurriculumWeek[]): CurriculumWeek[]
{
    return weeks.map((week) => ({
        ...week,
        days: week.days.map((day) => ({ ...day })),
    }));
}

export function pickNextDay(days: CurriculumDay[]): DayName | null
{
    const existing = new Set(days.map((day) => day.day));
    return dayOrder.find((dayName) => !existing.has(dayName)) ?? null;
}
