import { getMetaController } from "@/api-server/mongo-db-controller";
import {
    EMPTY_PERSONAL_SETTINGS,
    PersonalSettings,
} from "@/api-shared/types/personal-settings";

async function getPersonalSettings(
    userId: string,
): Promise<PersonalSettings> {
    const doc = await getMetaController().personalSettings.findOne({
        userId,
    });
    if (!doc) return EMPTY_PERSONAL_SETTINGS;
    return {
        groups: doc.groups,
        instructors: doc.instructors,
        favoriteOutsiders: doc.favoriteOutsiders,
    };
}

async function setPersonalSettings(
    userId: string,
    settings: PersonalSettings,
): Promise<PersonalSettings> {
    await getMetaController().personalSettings.updateOne(
        { userId },
        { $set: { userId, ...settings } },
        { upsert: true },
    );
    return settings;
}

export namespace DbPersonalSettings {
    export const get = getPersonalSettings;
    export const set = setPersonalSettings;
}
