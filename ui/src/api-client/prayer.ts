import { apiGetSetting, apiSetSetting } from "@/api-client/settings";
import {
    PrayerSettings,
    PRAYER_TIMES_SETTING_KEY,
} from "@/api-shared/types/settings/prayer";

export async function apiGetPrayerSettings() {
    return await apiGetSetting<PrayerSettings>(PRAYER_TIMES_SETTING_KEY);
}

export async function apiSetPrayerSettings(settings: PrayerSettings) {
    return await apiSetSetting<PrayerSettings>(PRAYER_TIMES_SETTING_KEY, settings);
}
