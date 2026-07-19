export const dynamic = "force-dynamic";

import { ApiSuccess, withApi } from "@/api-server/common";
import { DbPersonalSettings } from "@/api-server/db-personal-settings";
import {
    isGoogleCalendarConfigured,
    isGoogleCalendarConnected,
} from "@/api-server/google/google-calendar-service";
import { getSessionUser } from "@/api-server/session-user";
import { UserNotLoggedInError } from "@/api-shared/errors";
import { ApiGoogleCalendarStatusResponse } from "@/api-shared/types/google-calendar";

/** GET /api/integrations/google-calendar/status */
export const GET = withApi(async () => {
    const user = await getSessionUser();
    if (!user) throw new UserNotLoggedInError("אינך מחובר");

    const [settings, connected] = await Promise.all([
        DbPersonalSettings.get(user.id),
        isGoogleCalendarConnected(user.id),
    ]);

    const response: ApiGoogleCalendarStatusResponse = {
        configured: isGoogleCalendarConfigured(),
        connected,
        enabled: settings.googleCalendarEnabled,
    };
    return ApiSuccess(response, "no-store");
});
