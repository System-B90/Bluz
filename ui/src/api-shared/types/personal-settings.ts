export type PersonalSettings = {
    groups: Array<string>;
    instructors: Array<string>;
    favoriteOutsiders: Array<string>;
};

export const EMPTY_PERSONAL_SETTINGS: PersonalSettings = {
    groups: [],
    instructors: [],
    favoriteOutsiders: [],
};

export type ApiPersonalSettingsGetResponse = PersonalSettings;
export type ApiPersonalSettingsSetPayload = PersonalSettings;
export type ApiPersonalSettingsSetResponse = PersonalSettings;
