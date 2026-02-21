import { safeApiFetcher } from "@/api-client/common";
import { PRAYER_TIMES_SETTING_KEY, PrayerSettings } from "@/api-shared/types/settings/prayer";

async function apiGetSetting<T>(name: string)
{
    return (await safeApiFetcher(`/api/settings/${name}`)) as T;

}
async function apiSetSetting<T>(name: string, value: T)
{
    (await safeApiFetcher(`/api/settings/${name}`, {
        method: 'POST',
        body: JSON.stringify(value)
    }));

}

export async function apiGetPrayerSettings()
{
    return apiGetSetting<PrayerSettings>(PRAYER_TIMES_SETTING_KEY);
}

export async function apiSetPrayerSettings(settings: PrayerSettings)
{
    return apiSetSetting<PrayerSettings>(PRAYER_TIMES_SETTING_KEY, settings);
}
