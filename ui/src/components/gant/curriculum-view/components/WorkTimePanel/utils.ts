import { CurriculumWeekId, DayIndex } from '@/api-shared/types/gant/curriculum';

const dayOrder: DayIndex[] = [
    DayIndex.Sunday,
    DayIndex.Monday,
    DayIndex.Tuesday,
    DayIndex.Wednesday,
    DayIndex.Thursday,
    DayIndex.Friday,
    DayIndex.Saturday,
];

// Clone an array of week IDs (weeks are now stored as IDs in the normalized store)
export function cloneWeeks(weekIds: CurriculumWeekId[]): CurriculumWeekId[]
{
    return [...weekIds];
}

export function pickNextDay(dayNameSet: Set<DayIndex>): DayIndex | null
{
    return dayOrder.find((dayName) => !dayNameSet.has(dayName)) ?? null;
}
