import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { CurriculumWeekId } from "@/api-shared/types/gantt/curriculum";

/**
 * Partitions the week IDs into N groups as balanced as possible.
 */
export function partitionWeeks(weekIds: Array<CurriculumWeekId>, groupCount: number): Array<Array<CurriculumWeekId>>
{
    const totalWeeks = weekIds.length;
    if (totalWeeks === 0) return [];

    const baseSize = Math.floor(totalWeeks / groupCount);
    const remainder = totalWeeks % groupCount;

    let currentIndex = 0;
    return Array.from({ length: groupCount }, (_, i) =>
    {
        const size = baseSize + (i < remainder ? 1 : 0);
        const group = weekIds.slice(currentIndex, currentIndex + size);
        currentIndex += size;
        return group;
    }).filter((group) => group.length > 0);
}

export function calculateTotalWorkingTimeForWeeks(weekIds: Array<CurriculumWeekId>, state: NormalizedStore): number
{
    return weekIds.reduce((accWeek, weekId) =>
    {
        const week = state.weeks[ weekId ];
        return accWeek + week.days.reduce((accDay, dayId) =>
        {
            const day = state.days[ dayId ];
            return accDay + day.totalWorkingMinutes / 60;
        }, 0);
    }, 0);
}

function _hashSyllabusToColorByHue(syllabusId: string, themePrimaryColor: string, opacity: number): string
{
    // Simple hash of the ID
    let hash = 0;
    for (let i = 0; i < syllabusId.length; i++)
    {
        hash = syllabusId.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Convert hex theme color to HSL (Simplified logic)
    // We use the hash to jitter the hue (0-360)
    const hueJitter = Math.abs(hash % 360);

    // Using CSS hsl() for easy manipulation
    // We keep saturation at 70% and lightness at 60% for distinct but legible colors
    return `hsla(${hueJitter}, 70%, 60%, ${opacity})`;
}

function hashSyllabusToColorByGoldenRatio(syllabusId: string, themePrimaryColor: string, opacity: number): string
{
    let hash = 0;
    for (let i = 0; i < syllabusId.length; i++)
    {
        hash = syllabusId.charCodeAt(i) + ((hash << 5) - hash);
    }

    const goldenRatioConjugate = 0.618033988749895;
    let h = (Math.abs(hash) * goldenRatioConjugate) % 1;

    const hue = Math.floor(h * 360);
    return `hsla(${hue}, 65%, 55%, ${opacity})`;
}

export function hashSyllabusToColor(syllabusId: string, themePrimaryColor: string, opacity: number)
{
    return hashSyllabusToColorByGoldenRatio(syllabusId, themePrimaryColor, opacity);
}
