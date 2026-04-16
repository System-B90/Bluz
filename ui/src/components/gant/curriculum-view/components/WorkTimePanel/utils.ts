import { CurriculumWeekId, DayName } from '@/api-shared/types/gant/curriculum';

const dayOrder: DayName[] = [
    DayName.Sunday,
    DayName.Monday,
    DayName.Tuesday,
    DayName.Wednesday,
    DayName.Thursday,
    DayName.Friday,
    DayName.Saturday,
];

// Clone an array of week IDs (weeks are now stored as IDs in the normalized store)
export function cloneWeeks(weekIds: CurriculumWeekId[]): CurriculumWeekId[]
{
    return [...weekIds];
}

export function pickNextDay(dayNameSet: Set<DayName>): DayName | null
{
    return dayOrder.find((dayName) => !dayNameSet.has(dayName)) ?? null;
}
