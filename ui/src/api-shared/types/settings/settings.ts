import {
    PrayerSettings,
    PRAYER_TIMES_SETTING_KEY,
} from "@/api-shared/types/settings/prayer";

export type Setting = PrayerSettings;

export type SettingName = typeof PRAYER_TIMES_SETTING_KEY;

export type ApiSettingGetPayload = void;
export type ApiSettingGetResponse = Setting;

export type ApiSettingUpdatePayload = Partial<Setting>;
export type ApiSettingUpdateResponse = void;
