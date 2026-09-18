export const dynamic = "force-dynamic";

import { getAiProvider, isAiConfigured } from "@/api-server/ai";
import { toolSummaries } from "@/api-server/ai/tools";
import { ApiSuccess, withApi } from "@/api-server/common";
import { DbPersonalSettings } from "@/api-server/db-personal-settings";
import { requireStaffSession } from "@/api-server/session-user";

/**
 * What the assistant can do, for the chat's capability hint. Also reports
 * whether AI is configured at all, so the UI can hide the launcher on a
 * deployment with no key rather than failing on first use, and which model
 * would actually answer — the personal-settings card shows it so a user with
 * their own key can tell it apart from the server's default.
 */
export const GET = withApi(async () => {
    const user = await requireStaffSession();
    const personalSettings = await DbPersonalSettings.get(String(user.id));
    const apiKeyOverride = personalSettings.aiApiToken || undefined;
    const enabled = isAiConfigured(apiKeyOverride);
    return ApiSuccess({
        enabled,
        model: enabled ? getAiProvider(apiKeyOverride).defaultModel : null,
        tools: toolSummaries(),
    });
});
