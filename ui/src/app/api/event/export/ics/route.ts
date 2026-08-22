export const dynamic = "force-dynamic";

import { withApi } from "@/api-server/common";
import { DbEvent } from "@/api-server/db-event";
import { resolveIterationFromRequest } from "@/api-server/iteration-request";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { buildScheduleIcsCalendar } from "@/app/api/event/export/ics/calendar";
import {
    MAX_EVENT_RANGE_DAYS,
    MILLISECONDS_IN_A_DAY,
} from "@/settings";

/** GET /api/event/export/ics?sd=<ISO>&ed=<ISO> — exports the events in range as an ICS calendar. */
export const GET = withApi(async (request: Request) => {
    await requireStaffSession();
    const url = new URL(request.url);
    const rawStartDate = url.searchParams.get("sd");
    const rawEndDate = url.searchParams.get("ed");
    if (!rawStartDate || !rawEndDate) {
        throw new ClientApiError("יש לספק startDate ו-endDate לייצוא");
    }

    const start = new Date(rawStartDate);
    const end = new Date(rawEndDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new ClientApiError("תאריך לא תקין — יש לספק startDate ו-endDate תקינים");
    }

    const rangeDays = (end.getTime() - start.getTime()) / MILLISECONDS_IN_A_DAY;
    if (rangeDays > MAX_EVENT_RANGE_DAYS || rangeDays < 0) {
        throw new ClientApiError(
            `טווח התאריכים חייב להיות בין 0 ל-${MAX_EVENT_RANGE_DAYS} ימים`,
        );
    }

    const { controller } = await resolveIterationFromRequest(request);
    const events = await DbEvent.getInRange(start, end, undefined, undefined, controller);

    const calendar = buildScheduleIcsCalendar(events, "לוח זמנים - Bluz");
    const encodedFilename = encodeURIComponent("bluz-schedule.ics");

    const headers = new Headers();
    headers.set("Content-Type", "text/calendar; charset=utf-8");
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodedFilename}`);
    headers.set("Cache-Control", "no-store, max-age=0");

    return new Response(calendar, { status: 200, headers });
});
