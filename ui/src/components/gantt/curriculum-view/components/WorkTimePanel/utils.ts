import
{
    GanttDayIndex,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";

const dayOrder: GanttDayIndex[] = [
    GanttDayIndex.Sunday,
    GanttDayIndex.Monday,
    GanttDayIndex.Tuesday,
    GanttDayIndex.Wednesday,
    GanttDayIndex.Thursday,
    GanttDayIndex.Friday,
    GanttDayIndex.Saturday,
];

// Clone an array of week IDs (weeks are now stored as IDs in the normalized store)
export function cloneWeeks(weekIds: GanttWeekId[]): GanttWeekId[] {
    return [...weekIds];
}

export function pickNextDay(
    dayNameSet: Set<GanttDayIndex>,
): GanttDayIndex | null {
    return dayOrder.find((dayName) => !dayNameSet.has(dayName)) ?? null;
}
