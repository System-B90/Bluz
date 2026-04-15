import { CurriculumWeek } from "@/api-shared/types/gant/curriculum";

/**
 * Partitions the weeks into N groups as balanced as possible.
 */
export function partitionWeeks(weeks: Array<CurriculumWeek>, groupCount: number): Array<Array<CurriculumWeek>>
{
    const totalWeeks = weeks.length;
    if (totalWeeks === 0) return [];

    const baseSize = Math.floor(totalWeeks / groupCount);
    const remainder = totalWeeks % groupCount;

    let currentIndex = 0;
    return Array.from({ length: groupCount }, (_, i) =>
    {
        const size = baseSize + (i < remainder ? 1 : 0);
        const group = weeks.slice(currentIndex, currentIndex + size);
        currentIndex += size;
        return group;
    }).filter((group) => group.length > 0);
}

export function calculateTotalWorkingTimeForWeeks(weeks: Array<CurriculumWeek>): number
{
    return weeks.reduce(
        (total, week) =>
            total + week.days.reduce((weekTotal, day) => weekTotal + day.totalWorkingHours, 0),
        0
    );
}
