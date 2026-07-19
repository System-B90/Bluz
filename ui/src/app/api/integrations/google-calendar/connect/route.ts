export const dynamic = "force-dynamic";

import { ApiSuccess, withApi } from "@/api-server/common";
import {
    getGoogleAuthUrl,
    isGoogleCalendarConfigured,
} from "@/api-server/google/google-calendar-service";
import { getSessionUser } from "@/api-server/session-user";
import { ClientApiError, UserNotLoggedInError } from "@/api-shared/errors";
import { ApiGoogleCalendarConnectResponse } from "@/api-shared/types/google-calendar";

/** GET /api/integrations/google-calendar/connect — returns the Google consent URL. */
export const GET = withApi(async () => {
    const user = await getSessionUser();
    if (!user) throw new UserNotLoggedInError("אינך מחובר");

    if (!isGoogleCalendarConfigured()) {
        throw new ClientApiError(
            "אינטגרציית Google Calendar אינה מוגדרת בשרת זה",
        );
    }

    const response: ApiGoogleCalendarConnectResponse = {
        url: getGoogleAuthUrl(user.id),
    };
    return ApiSuccess(response);
});
