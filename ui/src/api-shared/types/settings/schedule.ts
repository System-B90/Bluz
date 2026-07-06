export const SCHEDULE_SETTINGS_KEY = "schedule";

export type ScheduleSettings = {
    /** Default day start time ("HH:mm") used when cutting a curriculum into the schedule. */
    dayStartTime: string;
};

export const DEFAULT_DAY_START_TIME = "08:00";
