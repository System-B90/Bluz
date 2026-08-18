import { BaseGantItem } from "@/api-shared/types/gantt/models/shared";
import { GanttWeekId } from "@/api-shared/types/gantt/models/week";

export enum GanttDayIndex {
    Sunday = 0,
    Monday = 1,
    Tuesday = 2,
    Wednesday = 3,
    Thursday = 4,
    Friday = 5,
    Saturday = 6,
}

export const DAY_NAME_DISPLAY: Record<GanttDayIndex, string> = {
    [GanttDayIndex.Sunday]: "ראשון",
    [GanttDayIndex.Monday]: "שני",
    [GanttDayIndex.Tuesday]: "שלישי",
    [GanttDayIndex.Wednesday]: "רביעי",
    [GanttDayIndex.Thursday]: "חמישי",
    [GanttDayIndex.Friday]: "שישי",
    [GanttDayIndex.Saturday]: "שבת",
};

export function getDayNameDisplay(day: GanttDayIndex): string {
    return DAY_NAME_DISPLAY[day] ?? "";
}

export const HEBREW_DAYS_SHORT = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"] as const;
export const HEBREW_DAYS_SINGLE_LETTER = ["א", "ב", "ג", "ד", "ה", "ו", "ש"] as const;

export type DayOfWeekConfig = {
    readonly index: GanttDayIndex;
    readonly label: string;
    readonly short: string;
};

export const DAYS_OF_WEEK: ReadonlyArray<DayOfWeekConfig> = [
    {
        index: GanttDayIndex.Sunday,
        label: getDayNameDisplay(GanttDayIndex.Sunday),
        short: HEBREW_DAYS_SINGLE_LETTER[GanttDayIndex.Sunday],
    },
    {
        index: GanttDayIndex.Monday,
        label: getDayNameDisplay(GanttDayIndex.Monday),
        short: HEBREW_DAYS_SINGLE_LETTER[GanttDayIndex.Monday],
    },
    {
        index: GanttDayIndex.Tuesday,
        label: getDayNameDisplay(GanttDayIndex.Tuesday),
        short: HEBREW_DAYS_SINGLE_LETTER[GanttDayIndex.Tuesday],
    },
    {
        index: GanttDayIndex.Wednesday,
        label: getDayNameDisplay(GanttDayIndex.Wednesday),
        short: HEBREW_DAYS_SINGLE_LETTER[GanttDayIndex.Wednesday],
    },
    {
        index: GanttDayIndex.Thursday,
        label: getDayNameDisplay(GanttDayIndex.Thursday),
        short: HEBREW_DAYS_SINGLE_LETTER[GanttDayIndex.Thursday],
    },
    {
        index: GanttDayIndex.Friday,
        label: getDayNameDisplay(GanttDayIndex.Friday),
        short: HEBREW_DAYS_SINGLE_LETTER[GanttDayIndex.Friday],
    },
    {
        index: GanttDayIndex.Saturday,
        label: getDayNameDisplay(GanttDayIndex.Saturday),
        short: HEBREW_DAYS_SINGLE_LETTER[GanttDayIndex.Saturday],
    },
] as const;
export type GanttDay = {
    readonly title: string; // Generated from day name
    weekId: GanttWeekId;
    dayIndex: GanttDayIndex;
    totalWorkingMinutes: number;
    /**
     * End of this day's working window ("HH:mm"). The cut treats the span from
     * the day's start time to this as the day's capacity, and never places an
     * event past it. `null` ⇒ derive as start + {@link GanttDay.totalWorkingMinutes},
     * which is how days behaved before the field existed.
     */
    dayEndTime?: null | string;
    comment?: string;
} & BaseGantItem;
export type GanttDayId = string;
