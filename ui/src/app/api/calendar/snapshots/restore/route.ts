export const dynamic = "force-dynamic";

import { ApiSuccess, withApi } from "@/api-server/common";
import { DbCalendarSnapshot } from "@/api-server/db-calendar-snapshot";
import { resolveWritableIterationFromRequest } from "@/api-server/iteration-request";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";

/**
 * POST /api/calendar/snapshots/restore?id=<uuid>
 *
 * Restores the calendar to the snapshot's captured state within the snapshot's
 * own date range: live events in that range are archived, the snapshot's
 * events are written back, and all connected clients are notified via
 * WebSocket broadcasts.
 */
export const POST = withApi(async (request: Request) => {
    await requireStaffSession();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
        throw new ClientApiError("No snapshot id provided.");
    }
    const { controller, iterationId } =
        await resolveWritableIterationFromRequest(request);
    return ApiSuccess(
        await DbCalendarSnapshot.restore(id, controller, iterationId),
    );
});
