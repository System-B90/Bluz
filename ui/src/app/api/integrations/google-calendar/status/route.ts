export const dynamic = "force-dynamic";

import { ApiSuccess, withApi } from "@/api-server/common";
import { DbPersonalSettings } from "@/api-server/db-personal-settings";
import {
    getGoogleClientId,
    getGoogleScopes,
    isGoogleCalendarConfigured,
    isGoogleCalendarConnected,
} from "@/api-server/google/google-calendar-service";
import { requireStaffSession } from "@/api-server/session-user";
import { ApiGoogleCalendarStatusResponse } from "@/api-shared/types/google-calendar";

/** GET /api/integrations/google-calendar/status */
export const GET = withApi(async () => {
    // Staff-only (#656): Google Calendar sync is a staff surface.
    const user = await requireStaffSession();

    const [settings, connected] = await Promise.all([
        DbPersonalSettings.get(user.id),
        isGoogleCalendarConnected(user.id),
    ]);

    const response: ApiGoogleCalendarStatusResponse = {
        configured: isGoogleCalendarConfigured(),
        connected,
        enabled: settings.googleCalendarEnabled,
        // Public OAuth client id + scopes for the browser-side GIS popup.
        clientId: getGoogleClientId(),
        scopes: getGoogleScopes(),
    };
    return ApiSuccess(response, "no-store");
});
