import { Dayjs } from "dayjs";

export const PRAYER_TIMES_SETTING_KEY = 'prayerTimes';

export interface PrayerSettings
{
    shacharit: Dayjs | Date;
    mincha: Dayjs | Date;
    arvit: Dayjs | Date;
}
