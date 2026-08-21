export const dynamic = "force-dynamic";

import { isAiConfigured } from "@/api-server/ai";
import { toolSummaries } from "@/api-server/ai/tools";
import { ApiSuccess, withApi } from "@/api-server/common";
import { requireStaffSession } from "@/api-server/session-user";

/**
 * What the assistant can do, for the chat's capability hint. Also reports
 * whether AI is configured at all, so the UI can hide the launcher on a
 * deployment with no key rather than failing on first use.
 */
export const GET = withApi(async () => {
    await requireStaffSession();
    return ApiSuccess({ enabled: isAiConfigured(), tools: toolSummaries() });
});
