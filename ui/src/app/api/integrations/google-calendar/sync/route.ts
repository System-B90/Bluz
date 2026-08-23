export const dynamic = "force-dynamic";

import { ApiSuccess, withApi } from "@/api-server/common";
import { DbEvent } from "@/api-server/db-event";
import { DbIterations } from "@/api-server/db-iterations";
import { DbPersonalSettings } from "@/api-server/db-personal-settings";
import {
    isGoogleCalendarConfigured,
    pullBusyBlocks,
    pullEventEdits,
    pushAllEvents,
} from "@/api-server/google/google-calendar-service";
import { getSessionUser } from "@/api-server/session-user";
import { ClientApiError, UserNotLoggedInError } from "@/api-shared/errors";
import { ApiGoogleCalendarSyncResponse } from "@/api-shared/types/google-calendar";

const SYNC_WINDOW_DAYS = 90;

/**
 * POST /api/integrations/google-calendar/sync — manual "sync now": pushes the
 * signed-in user's own upcoming events and pulls their Google busy blocks.
 */
export const POST = withApi(async () => {
    const user = await getSessionUser();
    if (!user) throw new UserNotLoggedInError("אינך מחובר");
    if (!isGoogleCalendarConfigured()) {
        throw new ClientApiError(
            "אינטגרציית Google Calendar אינה מוגדרת בשרת זה",
        );
    }

    const userIdAsNumber = Number(user.id);
    const now = new Date();
    const windowEnd = new Date(
        now.getTime() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    // Pull Google-side edits first so the push that follows doesn't overwrite
    // changes the user just made in Google Calendar.
    const updated = await pullEventEdits(user.id);

    const settings = await DbPersonalSettings.get(user.id);
    const events = await DbEvent.getInRange(
        now,
        windowEnd,
        undefined,
        settings.googleCalendarSyncAllEvents
            ? undefined
            : {
                $or: [
                    { instructors: userIdAsNumber },
                    { lecturers: userIdAsNumber },
                ],
            },
    );
    // These events come from the current iteration, so tag the Google copies
    // with it - that is what lets a later pull apply the edit to the right
    // database (#538 item 6).
    const currentIteration = await DbIterations.currentOrNull();
    const [pushed, busyBlocks] = await Promise.all([
        pushAllEvents(user.id, events, currentIteration?.id),
        pullBusyBlocks(user.id),
    ]);

    const response: ApiGoogleCalendarSyncResponse = {
        pushed,
        pulled: busyBlocks.length,
        updated,
    };
    return ApiSuccess(response);
});
