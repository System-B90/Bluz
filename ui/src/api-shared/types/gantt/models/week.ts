import type { GanttDayId } from "@/api-shared/types/gantt/models/day";
import { BaseGantItem } from "@/api-shared/types/gantt/models/shared";

export type GanttWeek = {
    readonly title: string; // Generated from week number
    readonly number: number; // Cannot be changed
    days: Array<GanttDayId>;
    comment?: string;
    weekendDuty: boolean;
} & BaseGantItem;
export type GanttWeekId = string;
