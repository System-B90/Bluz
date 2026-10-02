export type PersonalSettings = {
    groups: Array<string>;
    instructors: Array<string>;
    favoriteOutsiders: Array<string>;
    /**
     * Opt-in two-way sync of the user's own events to their Google Calendar.
     * Off by default — Bluz must work fully in offline/no-internet deployments.
     */
    googleCalendarEnabled: boolean;
    /**
     * When on, sync every schedule event (not just ones the user instructs/
     * lectures in) to the user's Google Calendar. Requires googleCalendarEnabled.
     */
    googleCalendarSyncAllEvents: boolean;
    /** Shows/hides the AI assistant FAB. On by default where AI is configured. */
    aiAssistantEnabled: boolean;
    /**
     * Per-user OpenRouter API key. Empty string means "use the server's
     * default key" (`OPENROUTER_API_KEY`), so a deployment with no personal
     * key still works when the server itself is configured.
     */
    aiApiToken: string;
    /**
     * Personal model choice (#779); "" = the server's `AI_MODEL`. Honoured
     * only with the user's own key or when the server's backend lists it.
     */
    aiModel: string;
};

export const EMPTY_PERSONAL_SETTINGS: PersonalSettings = {
    groups: [],
    instructors: [],
    favoriteOutsiders: [],
    googleCalendarEnabled: false,
    googleCalendarSyncAllEvents: false,
    aiAssistantEnabled: true,
    aiApiToken: "",
    aiModel: "",
};

export type ApiPersonalSettingsGetResponse = PersonalSettings;
export type ApiPersonalSettingsSetPayload = PersonalSettings;
export type ApiPersonalSettingsSetResponse = PersonalSettings;
