export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiSuccess, withApi } from "@/api-server/common";
import { DbEventHistory } from "@/api-server/db-event-history";
import { resolveIterationFromRequest } from "@/api-server/iteration-request";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { ApiEventHistoryResponse } from "@/api-shared/types/event-history";

/**
 * GET /api/event/history?id=<eventId> — the change log of a single event
 * ("היסטוריית שינויים"), newest first. Read-only: rows are written by the
 * write paths themselves (see `api-server/db-event-history.ts`).
 */
export const GET = withApi(async (request: NextRequest) => {
    // The log names who changed what and echoes whole event documents, so it
    // is staff-only — a logged-in check is not enough now that students can
    // hold a session (#656).
    await requireStaffSession();

    const eventId = request.nextUrl.searchParams.get("id");
    if (!eventId) throw new ClientApiError("No event id provided!");

    const { controller } = await resolveIterationFromRequest(request);
    const entries = await DbEventHistory.forEvent(eventId, controller);

    const payload: ApiEventHistoryResponse = entries.map((entry) => ({
        ...entry,
        changedAt: new Date(entry.changedAt).toISOString(),
    }));
    return ApiSuccess(payload);
});
