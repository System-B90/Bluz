export const dynamic = "force-dynamic";

import { getAiProvider } from "@/api-server/ai";
import { runAiBenchmark } from "@/api-server/ai/benchmark/run";
import { AiProviderError } from "@/api-server/ai/provider";
import {
    aiBenchmarkCooldownMs,
    allowAiBenchmark,
} from "@/api-server/ai/rate-limit";
import { ApiErrorMaker, ApiSuccess, withApi } from "@/api-server/common";
import { requireStaffSession } from "@/api-server/session-user";

/**
 * Runs the assistant self-test against a fabricated fixture (#704).
 *
 * Gated by the same staff session as `/api/ai/chat` and no more: any user can
 * point the deployment at a different model or key, so any user needs to be
 * able to check *theirs*. It is throttled hard instead, because a run costs
 * real tokens.
 *
 * Not streamed: a run is a handful of turns with nothing useful to show until
 * a case finishes, and the report is what the settings card renders.
 */
export const POST = withApi(async () => {
    const user = await requireStaffSession();

    if (!allowAiBenchmark(String(user.id))) {
        const minutes = Math.ceil(aiBenchmarkCooldownMs(String(user.id)) / 60_000);
        return ApiErrorMaker(
            {
                name: "AiRateLimitError",
                message: `בדיקת הסוכן זמינה פעם בשעה. נסה שוב בעוד ${minutes} דקות.`,
            },
            429,
        );
    }

    try {
        const result = await runAiBenchmark({
            provider: getAiProvider(),
            actor: {
                id: String(user.id),
                displayName: user.display_name || user.name || "משתמש",
            },
        });
        return ApiSuccess(result);
    } catch (e) {
        // A missing key or an unreachable gateway is a dependency fault, not a
        // bad request — and it is precisely what this endpoint exists to
        // surface, so it must come back readable rather than as a bare 500.
        if (e instanceof AiProviderError) {
            return ApiErrorMaker({ name: e.name, message: e.message }, 502);
        }
        throw e;
    }
});
