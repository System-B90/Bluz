/**
 * The AI setup a user's requests run on: their own key when they set one in
 * personal settings, else the server's (#783), plus their model choice
 * (#779). One place for what every `/api/ai/*` route used to repeat.
 */

import { AiProvider, getAiProvider, isAiConfigured } from "@/api-server/ai";
import { resolveChatModel } from "@/api-server/ai/models";
import { DbPersonalSettings } from "@/api-server/db-personal-settings";

export type UserAi = {
    /** The user's own API key, when set. */
    userKey: string | undefined;
    /** AI is usable for this user: the server's key or their own. */
    configured: boolean;
    /**
     * The provider chat would use.
     * @throws AiNotConfiguredError when neither key is set.
     */
    provider: () => AiProvider;
    /** The model to send, or undefined for the provider's default. */
    chatModel: (provider: AiProvider) => Promise<string | undefined>;
};

/** @param userId The signed-in user's id. */
export async function loadUserAi(userId: string): Promise<UserAi> {
    const settings = await DbPersonalSettings.get(userId);
    const userKey = settings.aiApiToken || undefined;
    return {
        userKey,
        configured: isAiConfigured(userKey),
        provider: () => getAiProvider(userKey),
        chatModel: (provider) => resolveChatModel(provider, settings.aiModel, Boolean(userKey)),
    };
}
