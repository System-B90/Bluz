export const SCHEDULE_SETTINGS_KEY = "schedule";

export type ScheduleSettings = {
    /** Default day start time ("HH:mm") used when cutting a curriculum into the schedule. */
    dayStartTime: string;
    /** Start time ("HH:mm") for the schedule after a weekend spent at home. */
    weekendHomeStartTime: string;
    /** Calendar view's earliest visible time ("HH:mm"), react-big-calendar's `min`. */
    calendarDayStartTime: string;
    /** Calendar view's latest visible time ("HH:mm"), react-big-calendar's `max`. */
    calendarDayEndTime: string;
};

export const DEFAULT_DAY_START_TIME = "08:00";
export const DEFAULT_WEEKEND_HOME_START_TIME = "10:00";
export const DEFAULT_CALENDAR_DAY_START_TIME = "07:00";
export const DEFAULT_CALENDAR_DAY_END_TIME = "22:00";
