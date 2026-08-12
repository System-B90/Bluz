export const dynamic = "force-dynamic";

import {
    normalizeStoredEvents,
    requireIdParam,
} from "@/api-server/calendar-store-request";
import { ApiSuccess, withApi } from "@/api-server/common";
import { DbCalendarSnapshot } from "@/api-server/db-calendar-snapshot";
import {
    resolveIterationFromRequest,
    resolveWritableIterationFromRequest,
} from "@/api-server/iteration-request";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { DbEventDocument } from "@/api-shared/types/event";

type CreateSnapshotBody = {
    label: string;
    events: Array<DbEventDocument>;
};

/**
 * GET /api/calendar/snapshots
 *   - no params  → list snapshots (summaries, newest first)
 *   - ?id=<uuid> → fetch one snapshot including its captured events (for restore)
 */
export const GET = withApi(async (request: Request) => {
    await requireStaffSession();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const { controller, iterationId } =
        await resolveIterationFromRequest(request);

    if (id) {
        return ApiSuccess(
            await DbCalendarSnapshot.get(id, controller),
            "no-store",
        );
    }
    return ApiSuccess(
        await DbCalendarSnapshot.list(controller, iterationId),
        "no-store",
    );
});

/** POST /api/calendar/snapshots — create a snapshot from the supplied events. */
export const POST = withApi(async (request: Request) => {
    await requireStaffSession();
    const { controller, iterationId } =
        await resolveWritableIterationFromRequest(request);
    const body = (await request.json()) as CreateSnapshotBody;
    if (!body || typeof body.label !== "string") {
        throw new ClientApiError("A snapshot label is required.");
    }
    const events = normalizeStoredEvents(body.events);

    return ApiSuccess(
        await DbCalendarSnapshot.create(
            body.label,
            events,
            controller,
            iterationId,
        ),
    );
});

/** DELETE /api/calendar/snapshots?id=<uuid> — remove a snapshot. */
export const DELETE = withApi(async (request: Request) => {
    await requireStaffSession();
    const id = requireIdParam(request, "No snapshot id provided.");
    const { controller } = await resolveWritableIterationFromRequest(
        request,
    );
    await DbCalendarSnapshot.del(id, controller);
    return ApiSuccess();
});
