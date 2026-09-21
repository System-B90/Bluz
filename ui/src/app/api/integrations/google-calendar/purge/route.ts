export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import {
    ApiSuccess,
    requireJsonObjectBody,
    withApi,
} from "@/api-server/common";
import {
    isGoogleCalendarConfigured,
    purgeGoogleEvents,
} from "@/api-server/google/google-calendar-service";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import {
    ApiGoogleCalendarPurgePayload,
    ApiGoogleCalendarPurgeResponse,
    GoogleCalendarPurgeScope,
} from "@/api-shared/types/google-calendar";

const SCOPES: ReadonlySet<GoogleCalendarPurgeScope> = new Set([
    "all",
    "orphaned",
]);

/**
 * POST /api/integrations/google-calendar/purge — removes Bluz-tagged events
 * from the signed-in user's linked Google calendar: `orphaned` (no live,
 * in-scope Bluz event of the calendar's iteration behind them) or `all`.
 * Events created by hand in Google are never touched.
 */
export const POST = withApi(async (request: NextRequest) => {
    // Staff-only (#656): Google Calendar sync is a staff surface.
    const user = await requireStaffSession();
    if (!isGoogleCalendarConfigured()) {
        throw new ClientApiError(
            "אינטגרציית Google Calendar אינה מוגדרת בשרת זה",
        );
    }

    const { scope } =
        await requireJsonObjectBody<ApiGoogleCalendarPurgePayload>(request);
    if (!SCOPES.has(scope)) {
        throw new ClientApiError('scope must be "orphaned" or "all".');
    }

    const response: ApiGoogleCalendarPurgeResponse = await purgeGoogleEvents(
        user.id,
        scope,
    );
    return ApiSuccess(response);
});
