import { apiGetSetting, apiSetSetting } from "@/api-client/settings";
import { IterationId } from "@/api-shared/types/iteration";
import {
    PrayerSettings,
    PRAYER_TIMES_SETTING_KEY,
} from "@/api-shared/types/settings/prayer";

export async function apiGetPrayerSettings(iterationId?: IterationId) {
    return await apiGetSetting<PrayerSettings>(
        PRAYER_TIMES_SETTING_KEY,
        iterationId,
    );
}

export async function apiSetPrayerSettings(
    settings: PrayerSettings,
    iterationId?: IterationId,
) {
    return await apiSetSetting<PrayerSettings>(
        PRAYER_TIMES_SETTING_KEY,
        settings,
        iterationId,
    );
}
