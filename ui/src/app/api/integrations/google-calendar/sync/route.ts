export const dynamic = "force-dynamic";

import { ApiSuccess, withApi } from "@/api-server/common";
import { DbEvent } from "@/api-server/db-event";
import { DbPersonalSettings } from "@/api-server/db-personal-settings";
import {
    getGoogleCalendarSelection,
    isGoogleCalendarConfigured,
    pullBusyBlocks,
    pullEventEdits,
    pushAllEvents,
} from "@/api-server/google/google-calendar-service";
import {
    getDatabaseController,
    resolveIterationDb,
} from "@/api-server/mongo-db-controller";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { ApiGoogleCalendarSyncResponse } from "@/api-shared/types/google-calendar";

const SYNC_WINDOW_DAYS = 90;

/**
 * POST /api/integrations/google-calendar/sync — manual "sync now": pushes the
 * signed-in user's own upcoming events from the iteration their calendar is
 * bound to, and pulls their Google busy blocks.
 */
export const POST = withApi(async () => {
    // Staff-only (#656): Google Calendar sync is a staff surface.
    const user = await requireStaffSession();
    if (!isGoogleCalendarConfigured()) {
        throw new ClientApiError(
            "אינטגרציית Google Calendar אינה מוגדרת בשרת זה",
        );
    }
    const calendar = await getGoogleCalendarSelection(user.id);
    if (!calendar) throw new ClientApiError("חשבון Google אינו מחובר");

    const userIdAsNumber = Number(user.id);
    const now = new Date();
    const windowEnd = new Date(
        now.getTime() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    // Pull Google-side edits first so the push that follows doesn't overwrite
    // changes the user just made in Google Calendar.
    const updated = await pullEventEdits(user.id);

    // The calendar mirrors one iteration — read from that one, not whichever
    // is current (a legacy link with no iteration still means "current").
    const { dbName } = await resolveIterationDb(calendar.iterationId);
    const controller = getDatabaseController(dbName);
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
        controller,
    );
    // Tag the Google copies with the iteration - that is what lets a later
    // pull apply the edit to the right database (#538 item 6).
    const [pushed, busyBlocks] = await Promise.all([
        pushAllEvents(user.id, events, calendar.iterationId),
        pullBusyBlocks(user.id),
    ]);

    const response: ApiGoogleCalendarSyncResponse = {
        pushed,
        pulled: busyBlocks.length,
        updated,
    };
    return ApiSuccess(response);
});
