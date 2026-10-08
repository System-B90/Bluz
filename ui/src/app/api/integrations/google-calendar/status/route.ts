export const dynamic = "force-dynamic";

import { ApiSuccess, withApi } from "@/api-server/common";
import { DbPersonalSettings } from "@/api-server/db-personal-settings";
import {
    getGoogleCalendarSelection,
    getGoogleClientId,
    getGoogleScopes,
    googleCalendarNeedsReauth,
    isGoogleCalendarConfigured,
} from "@/api-server/google/google-calendar-service";
import { requireStaffSession } from "@/api-server/session-user";
import { ApiGoogleCalendarStatusResponse } from "@/api-shared/types/google-calendar";

/** GET /api/integrations/google-calendar/status */
export const GET = withApi(async () => {
    // Staff-only (#656): Google Calendar sync is a staff surface.
    const user = await requireStaffSession();

    const [settings, calendar, needsReauth] = await Promise.all([
        DbPersonalSettings.get(user.id),
        getGoogleCalendarSelection(user.id),
        googleCalendarNeedsReauth(user.id),
    ]);

    const response: ApiGoogleCalendarStatusResponse = {
        configured: isGoogleCalendarConfigured(),
        // A link whose token Google refused is not usable: report it as
        // disconnected so the UI offers a reconnect (#914).
        connected: calendar !== null && !needsReauth,
        ...(needsReauth ? { needsReauth } : {}),
        enabled: settings.googleCalendarEnabled,
        // Public OAuth client id + scopes for the browser-side GIS popup.
        clientId: getGoogleClientId(),
        scopes: getGoogleScopes(),
        ...(calendar && !needsReauth ? { calendar } : {}),
    };
    return ApiSuccess(response, "no-store");
});
