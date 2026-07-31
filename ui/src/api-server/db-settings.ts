import { FindOptions, UpdateOptions, WithId } from "mongodb";

import {
    databaseController,
    DatabaseController,
} from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import {
    DEFAULT_BREAKFAST_TIME,
    DEFAULT_DINNER_TIME,
    DEFAULT_LUNCH_TIME,
    MEAL_TIMES_SETTING_KEY,
} from "@/api-shared/types/settings/meal";
import { PRAYER_TIMES_SETTING_KEY } from "@/api-shared/types/settings/prayer";
import {
    DEFAULT_CALENDAR_DAY_END_TIME,
    DEFAULT_CALENDAR_DAY_START_TIME,
    DEFAULT_DAY_START_TIME,
    DEFAULT_WEEKEND_HOME_START_TIME,
    SCHEDULE_SETTINGS_KEY,
} from "@/api-shared/types/settings/schedule";
import { Setting, SettingName } from "@/api-shared/types/settings/settings";
import { MessageTypes } from "@/settings";

type DbSetting = {
    key: SettingName;
    value: Setting;
};

async function getDbSetting(
    name: SettingName,
    options?: FindOptions,
    controller: DatabaseController = databaseController,
): Promise<null | Setting> {
    const data: null | WithId<DbSetting> = await controller.settings.findOne(
        { key: name },
        options,
    );
    return data ? data.value : null;
}

async function setDbSetting(
    name: SettingName,
    setting: Partial<Setting>,
    options?: UpdateOptions,
    controller: DatabaseController = databaseController,
) {
    await controller.settings.updateOne(
        { key: name },
        { $set: { value: setting } },
        options,
    );

    SendServerRequestToSessionServer(MessageTypes.SETTINGS_UPDATE, {
        settings: { [name]: setting },
    } as any);
}

async function initDbSettings() {
    const prayerSetting = await getDbSetting(PRAYER_TIMES_SETTING_KEY);
    if (prayerSetting === null) {
        await setDbSetting(
            PRAYER_TIMES_SETTING_KEY,
            {
                arvit: new Date(1970, 0, 1, 18, 0, 0, 0),
                mincha: new Date(1970, 0, 1, 12, 0, 0, 0),
                shacharit: new Date(1970, 0, 1, 6, 0, 0, 0),
            } as Setting,
            { upsert: true },
        );
    }

    const scheduleSetting = await getDbSetting(SCHEDULE_SETTINGS_KEY);
    if (scheduleSetting === null) {
        await setDbSetting(
            SCHEDULE_SETTINGS_KEY,
            {
                dayStartTime: DEFAULT_DAY_START_TIME,
                weekendHomeStartTime: DEFAULT_WEEKEND_HOME_START_TIME,
                calendarDayStartTime: DEFAULT_CALENDAR_DAY_START_TIME,
                calendarDayEndTime: DEFAULT_CALENDAR_DAY_END_TIME,
            } as Setting,
            { upsert: true },
        );
    }

    const mealSetting = await getDbSetting(MEAL_TIMES_SETTING_KEY);
    if (mealSetting === null) {
        await setDbSetting(
            MEAL_TIMES_SETTING_KEY,
            {
                breakfastTime: DEFAULT_BREAKFAST_TIME,
                lunchTime: DEFAULT_LUNCH_TIME,
                dinnerTime: DEFAULT_DINNER_TIME,
            } as Setting,
            { upsert: true },
        );
    }
}

export namespace DbSettings {
    export const get = getDbSetting;
    export const set = setDbSetting;
    export const init = initDbSettings;
}
