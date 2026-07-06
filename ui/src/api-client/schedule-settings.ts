import { apiGetSetting, apiSetSetting } from "@/api-client/settings";
import {
    ScheduleSettings,
    SCHEDULE_SETTINGS_KEY,
} from "@/api-shared/types/settings/schedule";

export async function apiGetScheduleSettings() {
    return await apiGetSetting<ScheduleSettings>(SCHEDULE_SETTINGS_KEY);
}

export async function apiSetScheduleSettings(settings: ScheduleSettings) {
    return await apiSetSetting<ScheduleSettings>(
        SCHEDULE_SETTINGS_KEY,
        settings,
    );
}
