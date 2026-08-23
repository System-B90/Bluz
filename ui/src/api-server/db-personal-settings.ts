import { pickFields } from "@/api-server/common";
import { getMetaController } from "@/api-server/mongo-db-controller";
import {
    EMPTY_PERSONAL_SETTINGS,
    PersonalSettings,
} from "@/api-shared/types/personal-settings";

const PERSONAL_SETTINGS_FIELDS = [
    "groups",
    "instructors",
    "favoriteOutsiders",
    "googleCalendarEnabled",
    "googleCalendarSyncAllEvents",
] as const;

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
        googleCalendarEnabled: doc.googleCalendarEnabled ?? false,
        googleCalendarSyncAllEvents: doc.googleCalendarSyncAllEvents ?? false,
        aiAssistantEnabled: doc.aiAssistantEnabled ?? true,
    };
}

async function setPersonalSettings(
    userId: string,
    settings: PersonalSettings,
): Promise<PersonalSettings> {
    // Whitelist rather than spread: the payload is client-supplied, and
    // spreading it let a caller store arbitrary keys on their settings
    // document (#538 item 4).
    const stored = pickFields(settings, PERSONAL_SETTINGS_FIELDS);
    await getMetaController().personalSettings.updateOne(
        { userId },
        { $set: { userId, ...stored } },
        { upsert: true },
    );
    return stored as PersonalSettings;
}

export namespace DbPersonalSettings {
    export const get = getPersonalSettings;
    export const set = setPersonalSettings;
}
