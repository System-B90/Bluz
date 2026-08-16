export const dynamic = "force-dynamic";

import { ApiSuccess, ServerApi, withApi } from "@/api-server/common";
import { DbEvent, DbEventDocument } from "@/api-server/db-event";
import { resolveIterationDb } from "@/api-server/mongo-db-controller";
import { ClientApiError } from "@/api-shared/errors";

type CompareResponse = {
    a: Array<DbEventDocument>;
    b: Array<DbEventDocument>;
};
type ServerApiEventCompare = ServerApi<void, CompareResponse>;

/**
 * Single round-trip side-by-side comparison: returns the events of two
 * iterations over the same date range. `itA` / `itB` select the iterations
 * (omit either for the current one).
 */
export const GET: ServerApiEventCompare = withApi(async (request) => {
    const params = request.nextUrl.searchParams;
    const itA = params.get("itA") ?? undefined;
    const itB = params.get("itB") ?? undefined;
    const rawStart = params.get("sd");
    const rawEnd = params.get("ed");

    if (!rawStart || !rawEnd) {
        throw new ClientApiError("יש לספק טווח תאריכים (sd, ed)");
    }
    const start = new Date(rawStart);
    const end = new Date(rawEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new ClientApiError("תאריך לא תקין");
    }
    // Same ceiling as /api/event: without it a caller can ask two iterations
    // for an unbounded span and turn one request into two full scans.
    const MAX_RANGE_DAYS = 366;
    const rangeDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (rangeDays > MAX_RANGE_DAYS || rangeDays < 0) {
        throw new ClientApiError(
            `טווח התאריכים חייב להיות בין 0 ל-${MAX_RANGE_DAYS} ימים`,
        );
    }

    const [controllerA, controllerB] = await Promise.all([
        resolveIterationDb(itA),
        resolveIterationDb(itB),
    ]);

    const [a, b] = await Promise.all([
        DbEvent.getInRange(start, end, undefined, undefined, controllerA),
        DbEvent.getInRange(start, end, undefined, undefined, controllerB),
    ]);

    return ApiSuccess({ a, b });
});
