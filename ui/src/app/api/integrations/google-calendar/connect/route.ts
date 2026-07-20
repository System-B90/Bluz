export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiSuccess, withApi } from "@/api-server/common";
import {
    connectGoogleCalendar,
    isGoogleCalendarConfigured,
} from "@/api-server/google/google-calendar-service";
import { getSessionUser } from "@/api-server/session-user";
import { ClientApiError, UserNotLoggedInError } from "@/api-shared/errors";
import { ApiGoogleCalendarConnectPayload } from "@/api-shared/types/google-calendar";

/**
 * POST /api/integrations/google-calendar/connect — receives the authorization
 * code produced by the browser-side Google Identity Services popup
 * ("Continue with Google") and exchanges it for tokens. The GIS code model
 * requires the popup page's origin as the redirect_uri during exchange, so
 * no redirect URI is ever registered or configured server-side.
 */
export const POST = withApi(async (request: NextRequest) => {
    const user = await getSessionUser();
    if (!user) throw new UserNotLoggedInError("אינך מחובר");

    if (!isGoogleCalendarConfigured()) {
        throw new ClientApiError(
            "אינטגרציית Google Calendar אינה מוגדרת בשרת זה",
        );
    }

    const { code } = (await request.json()) as ApiGoogleCalendarConnectPayload;
    if (!code) throw new ClientApiError("Missing Google authorization code.");

    await connectGoogleCalendar(user.id, code, request.nextUrl.origin);
    return ApiSuccess();
});
