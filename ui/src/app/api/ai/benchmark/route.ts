export const dynamic = "force-dynamic";

import {
    getBenchmarkJob,
    startBenchmarkJob,
} from "@/api-server/ai/benchmark/job";
import {
    aiBenchmarkCooldownMs,
    allowAiBenchmark,
} from "@/api-server/ai/rate-limit";
import { loadUserAi } from "@/api-server/ai/user-ai";
import { ApiErrorMaker, ApiSuccess, withApi } from "@/api-server/common";
import { requireStaffSession } from "@/api-server/session-user";
import { AiBenchmarkJobStatus } from "@/api-shared/types/ai-benchmark";

/**
 * Assistant self-test against a fabricated fixture (#704).
 *
 * Gated by the same staff session as `/api/ai/chat` and no more: any user can
 * point the deployment at a different model or key, so any user needs to be
 * able to check *theirs*. It is throttled hard instead, because a run costs
 * real tokens.
 *
 * A run takes minutes — past a proxy's request timeout — so POST only starts
 * it in the background and answers at once; GET reports its state.
 */
export const GET = withApi(async () => {
    const user = await requireStaffSession();
    return ApiSuccess(getBenchmarkJob(String(user.id)));
});

export const POST = withApi(async () => {
    const user = await requireStaffSession();
    const userId = String(user.id);

    // A run already in flight is attached to, not counted against the throttle.
    const running = getBenchmarkJob(userId);
    if (running.status === AiBenchmarkJobStatus.Running) return ApiSuccess(running);

    // Built before the throttle so a misconfigured deployment does not burn
    // the user's one run per hour.
    const provider = (await loadUserAi(userId)).provider();

    if (!allowAiBenchmark(userId)) {
        const minutes = Math.ceil(aiBenchmarkCooldownMs(userId) / 60_000);
        return ApiErrorMaker(
            {
                name: "AiRateLimitError",
                message: `בדיקת הסוכן זמינה פעם בשעה. נסה שוב בעוד ${minutes} דקות.`,
            },
            429,
        );
    }

    // Same provider chat would use for this user: their personal token when
    // set, else the server key (#783). A missing key throws here and answers
    // with its own message (#782); an unreachable gateway surfaces as a Failed
    // job on the next poll, as the request has already returned by then.
    const { job } = startBenchmarkJob({
        provider,
        actor: {
            id: userId,
            displayName: user.display_name || user.name || "משתמש",
        },
    });
    return ApiSuccess(job);
});
