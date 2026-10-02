export const dynamic = "force-dynamic";

import { getAiProvider, isAiConfigured } from "@/api-server/ai";
import { discoverModels } from "@/api-server/ai/models";
import { ApiSuccess, withApi } from "@/api-server/common";
import { DbPersonalSettings } from "@/api-server/db-personal-settings";
import { requireStaffSession } from "@/api-server/session-user";
import { ApiAiModelsResponse } from "@/api-shared/types/ai-models";

/**
 * Models the configured backend offers (#779), for the personal-settings
 * dropdown. Listed with the same key chat would use, so a personal key sees
 * its own account's models.
 */
export const GET = withApi(async () => {
    const user = await requireStaffSession();
    const personalSettings = await DbPersonalSettings.get(String(user.id));
    const apiKeyOverride = personalSettings.aiApiToken || undefined;
    if (!isAiConfigured(apiKeyOverride)) {
        return ApiSuccess<ApiAiModelsResponse>({ models: [], defaultModel: "", error: "AI אינו מוגדר" });
    }
    return ApiSuccess(await discoverModels(getAiProvider(apiKeyOverride)));
});
