export const dynamic = "force-dynamic";

import { toolSummaries } from "@/api-server/ai/tools";
import { loadUserAi } from "@/api-server/ai/user-ai";
import { ApiSuccess, withApi } from "@/api-server/common";
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
    const ai = await loadUserAi(String(user.id));
    const provider = ai.configured ? ai.provider() : null;
    // The model that would really answer: the personal one when honoured.
    const model = provider ? (await ai.chatModel(provider)) ?? provider.defaultModel : null;
    return ApiSuccess({
        enabled: ai.configured,
        model,
        tools: toolSummaries(),
    });
});
