export const dynamic = "force-dynamic";

import { ApiSuccess, withApi } from "@/api-server/common";
import { disconnectGoogleCalendar } from "@/api-server/google/google-calendar-service";
import { getSessionUser } from "@/api-server/session-user";
import { UserNotLoggedInError } from "@/api-shared/errors";

/** POST /api/integrations/google-calendar/disconnect */
export const POST = withApi(async () => {
    const user = await getSessionUser();
    if (!user) throw new UserNotLoggedInError("אינך מחובר");

    await disconnectGoogleCalendar(user.id);
    return ApiSuccess();
});
