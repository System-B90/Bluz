import { apiGetSetting, apiSetSetting } from "@/api-client/settings";
import { IterationId } from "@/api-shared/types/iteration";
import {
    MealSettings,
    MEAL_TIMES_SETTING_KEY,
} from "@/api-shared/types/settings/meal";

export async function apiGetMealSettings(iterationId?: IterationId) {
    return await apiGetSetting<MealSettings>(
        MEAL_TIMES_SETTING_KEY,
        iterationId,
    );
}

export async function apiSetMealSettings(
    settings: MealSettings,
    iterationId?: IterationId,
) {
    return await apiSetSetting<MealSettings>(
        MEAL_TIMES_SETTING_KEY,
        settings,
        iterationId,
    );
}
