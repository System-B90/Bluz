import {
    MealSettings,
    MEAL_TIMES_SETTING_KEY,
} from "@/api-shared/types/settings/meal";
import {
    PrayerSettings,
    PRAYER_TIMES_SETTING_KEY,
} from "@/api-shared/types/settings/prayer";
import {
    ScheduleSettings,
    SCHEDULE_SETTINGS_KEY,
} from "@/api-shared/types/settings/schedule";

export type Setting = PrayerSettings & ScheduleSettings & MealSettings;

export type SettingName =
    | typeof MEAL_TIMES_SETTING_KEY
    | typeof PRAYER_TIMES_SETTING_KEY
    | typeof SCHEDULE_SETTINGS_KEY;

export type ApiSettingGetPayload = void;
export type ApiSettingGetResponse = Setting;

export type ApiSettingUpdatePayload = Partial<Setting>;
export type ApiSettingUpdateResponse = void;
