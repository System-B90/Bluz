import { BaseGantItem } from "@/api-shared/types/gantt/models/shared";
import { GanttWeekId } from "@/api-shared/types/gantt/models/week";

export enum GanttDayIndex
{
    Sunday = 0,
    Monday = 1,
    Tuesday = 2,
    Wednesday = 3,
    Thursday = 4,
    Friday = 5,
    Saturday = 6,
}

export const DAY_NAME_DISPLAY: Record<GanttDayIndex, string> = {
    [ GanttDayIndex.Sunday ]: 'ראשון',
    [ GanttDayIndex.Monday ]: 'שני',
    [ GanttDayIndex.Tuesday ]: 'שלישי',
    [ GanttDayIndex.Wednesday ]: 'רביעי',
    [ GanttDayIndex.Thursday ]: 'חמישי',
    [ GanttDayIndex.Friday ]: 'שישי',
    [ GanttDayIndex.Saturday ]: 'שבת',
};

export function getDayNameDisplay(day: GanttDayIndex): string
{
    return DAY_NAME_DISPLAY[ day ] ?? '';
}
export interface GanttDay extends BaseGantItem
{
    readonly title: string;  // Generated from day name
    weekId: GanttWeekId;
    dayIndex: GanttDayIndex;
    totalWorkingMinutes: number;
    comment?: string;
}
export type GanttDayId = string;
