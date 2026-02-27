import databaseController from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { ClientApiError } from "@/api-shared/errors";
import { PRAYER_TIMES_SETTING_KEY } from "@/api-shared/types/settings/prayer";
import { Setting, SettingName } from "@/api-shared/types/settings/settings";
import { MessageTypes } from "@/settings";
import { FindOptions, UpdateOptions, WithId } from "mongodb";
import logger from "@/logging/pino"

interface DbSetting
{
    key: SettingName;
    value: Setting;
}

async function getDbSetting(name: SettingName, options?: FindOptions): Promise<Setting | null>
{
    const data: WithId<DbSetting> | null = await databaseController.settings.findOne({ 'key': name }, options);
    return data ? data.value : null;
}

async function setDbSetting(name: SettingName, setting: Partial<Setting>, options?: UpdateOptions)
{
    const data = await databaseController.settings.updateOne({ 'key': name }, { '$set': { value: setting } }, options);
    if (data.matchedCount === 0 && !options?.upsert)
    {
        throw new ClientApiError(`No setting by name ${name} found!`);
    }
    if (data.modifiedCount === 0)
    {
        throw new ClientApiError(`Setting ${name} data not modified!`);
    }
    SendServerRequestToSessionServer(MessageTypes.SETTINGS_UPDATE, { settings: { [ name ]: setting } } as any);
}

async function initDbSettings()
{
    logger.info("Initializing DB Settings from DB");
    const prayerSetting = await getDbSetting(PRAYER_TIMES_SETTING_KEY);
    if (prayerSetting !== null) {
        logger.debug("DB Settings already initialized");
        return;
    }

    await setDbSetting(PRAYER_TIMES_SETTING_KEY, {
        'arvit': new Date(1970, 0, 1, 18, 0, 0, 0),
        'mincha': new Date(1970, 0, 1, 12, 0, 0, 0),
        'shacharit': new Date(1970, 0, 1, 6, 0, 0, 0)
    } as Setting, { upsert: true });
    logger.info("Successfully initialized Settings DB");
}


export namespace DbSettings
{
    export const get = getDbSetting;
    export const set = setDbSetting;
    export const init = initDbSettings;
}
