import { Dayjs } from "dayjs";

export const PRAYER_TIMES_SETTING_KEY = 'prayerTimes';

export interface PrayerSettings
{
    shacharit: Date | Dayjs;
    mincha: Date | Dayjs;
    arvit: Date | Dayjs;
}
