export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import {
    ApiSuccess,
    requireJsonObjectBody,
    withApi,
} from "@/api-server/common";
import {
    isGoogleCalendarConfigured,
    listGoogleCalendarOptions,
    selectGoogleCalendar,
} from "@/api-server/google/google-calendar-service";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import {
    ApiGoogleCalendarListResponse,
    ApiGoogleCalendarSelectPayload,
    ApiGoogleCalendarSelectResponse,
} from "@/api-shared/types/google-calendar";

function requireConfigured(): void {
    if (!isGoogleCalendarConfigured()) {
        throw new ClientApiError(
            "אינטגרציית Google Calendar אינה מוגדרת בשרת זה",
        );
    }
}

/**
 * GET /api/integrations/google-calendar/calendars — the calendars the
 * signed-in user can mirror into: their own, plus any a colleague shared
 * with write access (which is how several users end up on one calendar).
 */
export const GET = withApi(async () => {
    // Staff-only (#656): Google Calendar sync is a staff surface.
    const user = await requireStaffSession();
    requireConfigured();

    const response: ApiGoogleCalendarListResponse =
        await listGoogleCalendarOptions(user.id);
    return ApiSuccess(response, "no-store");
});

/**
 * POST /api/integrations/google-calendar/calendars — re-point the user's
 * link at another calendar (`{ calendarId }`) or a fresh Bluz-created one
 * (`{ createNew: true }`).
 */
export const POST = withApi(async (request: NextRequest) => {
    const user = await requireStaffSession();
    requireConfigured();

    const payload =
        await requireJsonObjectBody<ApiGoogleCalendarSelectPayload>(request);
    const hasCalendarId =
        "calendarId" in payload && typeof payload.calendarId === "string";
    const wantsNew = "createNew" in payload && payload.createNew === true;
    if (hasCalendarId === wantsNew) {
        throw new ClientApiError(
            "Provide exactly one of calendarId or createNew.",
        );
    }

    const response: ApiGoogleCalendarSelectResponse =
        await selectGoogleCalendar(user.id, payload);
    return ApiSuccess(response);
});
