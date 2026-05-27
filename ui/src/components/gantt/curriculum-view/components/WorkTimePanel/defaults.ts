import { getDefaultWorkingMinutesForDay } from "@/api-shared/gantt/week-defaults";
import {
    DAY_NAME_DISPLAY,
    GanttDay,
    GanttDayIndex,
} from "@/api-shared/types/gantt/models";

export const defaultWeekDayOrder: Array<GanttDayIndex> = [
    GanttDayIndex.Sunday,
    GanttDayIndex.Monday,
    GanttDayIndex.Tuesday,
    GanttDayIndex.Wednesday,
    GanttDayIndex.Thursday,
    GanttDayIndex.Friday,
];

export function buildDefaultWeekDays(): Array<Partial<GanttDay>> {
    return defaultWeekDayOrder.map((dayName) => ({
        title: DAY_NAME_DISPLAY[dayName],
        dayIndex: dayName,
        totalWorkingMinutes: getDefaultWorkingMinutesForDay(dayName),
        comment: "",
    }));
}
