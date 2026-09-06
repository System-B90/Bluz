export const dynamic = "force-dynamic";

import { ApiSuccess, withApi } from "@/api-server/common";
import { disconnectGoogleCalendar } from "@/api-server/google/google-calendar-service";
import { requireStaffSession } from "@/api-server/session-user";

/** POST /api/integrations/google-calendar/disconnect */
export const POST = withApi(async () => {
    // Staff-only (#656): Google Calendar sync is a staff surface.
    const user = await requireStaffSession();

    await disconnectGoogleCalendar(user.id);
    return ApiSuccess();
});
