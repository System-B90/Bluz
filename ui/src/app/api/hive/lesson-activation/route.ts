export const dynamic = "force-dynamic";

import { ApiSuccess, ServerApi, withApi } from "@/api-server/common";
import { runLessonActivationTick } from "@/api-server/hive/lesson-activation";
import { resolveWritableIterationFromRequest } from "@/api-server/iteration-request";
import { HiveActivationTickResult } from "@/api-shared/types/hive-activation";

type ServerApiLessonActivationRun = ServerApi<void, HiveActivationTickResult>;

/**
 * POST /api/hive/lesson-activation — run one activation pass now and report
 * what it did.
 *
 * The pass is what the background timer runs every 30 seconds, and it is
 * idempotent, so triggering it by hand can only ever bring the queues forward
 * to where they should already be. It exists because the timer is otherwise
 * invisible: when a queue does not open, this is how staff (and the e2e
 * suite) find out whether the event was even considered, and why not.
 */
export const POST: ServerApiLessonActivationRun = withApi(async (request) => {
    // Same guard as any other write: only the writable (current) iteration
    // may drive Hive, and only an authenticated session gets here.
    const { controller } = await resolveWritableIterationFromRequest(request);
    return ApiSuccess(await runLessonActivationTick(new Date(), controller));
});
