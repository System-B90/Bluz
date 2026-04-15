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

function hashSyllabusToColorByHue(syllabusId: string, themePrimaryColor: string, opacity: number): string
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
