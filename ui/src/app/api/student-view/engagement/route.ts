export const dynamic = "force-dynamic";

import {
    ApiSuccess,
    requireJsonObjectBody,
    ServerApi,
    withApi,
} from "@/api-server/common";
import { addStudentEngagementSeconds } from "@/api-server/db-student-engagement";
import {
    currentAppDate,
    requireStudentViewSession,
} from "@/api-server/student-view";
import {
    ApiStudentEngagementPostPayload,
    ApiStudentEngagementPostResponse,
} from "@/api-shared/types/student-view";

type ServerApiStudentEngagementPost = ServerApi<
    ApiStudentEngagementPostPayload,
    ApiStudentEngagementPostResponse
>;

/**
 * Records how long the student-view board has been open *and* focused (#656).
 *
 * The body carries a duration and nothing else: the user id comes from the
 * session and the date from the server clock, so a student can only ever add
 * to their own counter, for today. The increment is clamped and the daily
 * total capped in `db-student-engagement`, so a forged report buys at most a
 * day's worth of seconds against the reporter's own number.
 *
 * Staff previewing the board report too; their rows are simply never read.
 */
export const POST: ServerApiStudentEngagementPost = withApi(
    async (request) => {
        const { userId } = await requireStudentViewSession();

        const { seconds } =
            await requireJsonObjectBody<ApiStudentEngagementPostPayload>(
                request,
            );

        await addStudentEngagementSeconds(
            userId,
            currentAppDate(),
            typeof seconds === "number" ? seconds : 0,
        );

        // Deliberately empty: the counter is not a student-facing number.
        return ApiSuccess();
    },
);
