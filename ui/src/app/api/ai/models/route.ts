export const dynamic = "force-dynamic";

import { discoverModels } from "@/api-server/ai/models";
import { loadUserAi } from "@/api-server/ai/user-ai";
import { ApiSuccess, withApi } from "@/api-server/common";
import { requireStaffSession } from "@/api-server/session-user";
import { ApiAiModelsResponse } from "@/api-shared/types/ai-models";

/**
 * Models the configured backend offers (#779), for the personal-settings
 * dropdown. Listed with the same key chat would use, so a personal key sees
 * its own account's models.
 */
export const GET = withApi(async () => {
    const user = await requireStaffSession();
    const ai = await loadUserAi(String(user.id));
    if (!ai.configured) {
        return ApiSuccess<ApiAiModelsResponse>({ models: [], defaultModel: "", error: "AI אינו מוגדר" });
    }
    return ApiSuccess(await discoverModels(ai.provider()));
});
