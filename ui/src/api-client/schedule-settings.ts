import { apiGetSetting, apiSetSetting } from "@/api-client/settings";
import { IterationId } from "@/api-shared/types/iteration";
import {
    ScheduleSettings,
    SCHEDULE_SETTINGS_KEY,
} from "@/api-shared/types/settings/schedule";

export async function apiGetScheduleSettings(iterationId?: IterationId) {
    return await apiGetSetting<ScheduleSettings>(
        SCHEDULE_SETTINGS_KEY,
        iterationId,
    );
}

export async function apiSetScheduleSettings(
    settings: ScheduleSettings,
    iterationId?: IterationId,
) {
    return await apiSetSetting<ScheduleSettings>(
        SCHEDULE_SETTINGS_KEY,
        settings,
        iterationId,
    );
}
