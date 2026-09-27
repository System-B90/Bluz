import {
    HIVE_INTEGRATION_SETTING_KEY,
    HiveIntegrationSettings,
} from "@/api-shared/types/settings/hive-integration";
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

export type Setting = PrayerSettings &
    ScheduleSettings &
    MealSettings &
    HiveIntegrationSettings;

export type SettingName =
    | typeof HIVE_INTEGRATION_SETTING_KEY
    | typeof MEAL_TIMES_SETTING_KEY
    | typeof PRAYER_TIMES_SETTING_KEY
    | typeof SCHEDULE_SETTINGS_KEY;

export type ApiSettingGetPayload = void;
export type ApiSettingGetResponse = Setting;

export type ApiSettingUpdatePayload = Partial<Setting>;
export type ApiSettingUpdateResponse = void;
