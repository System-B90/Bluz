export const dynamic = "force-dynamic";

import {
    ApiSuccess,
    requireJsonObjectBody,
    ServerApi,
    withApi,
} from "@/api-server/common";
import { DbEvent } from "@/api-server/db-event";
import {
    pullGoogleEditsInBackground,
    syncEventToInstructorsGoogleCalendars,
} from "@/api-server/google/google-calendar-sync";
import { syncEventLessonToHive } from "@/api-server/hive/lesson-sync";
import {
    resolveIterationFromRequest,
    resolveWritableIterationFromRequest,
} from "@/api-server/iteration-request";
import { requireStaffSession, getSessionUser } from "@/api-server/session-user";
import { eventDateFixupToDate } from "@/api-shared/calendar";
import { ClientApiError } from "@/api-shared/errors";
import {
    ApiEventCreatePayload,
    ApiEventCreateResponse,
    ApiEventDeletePayload,
    ApiEventDeleteResponse,
    ApiEventGetPayload,
    ApiEventGetResponse,
    ApiEventUpdatePayload,
    ApiEventUpdateResponse,
    DbEventDocument,
    EventId,
} from "@/api-shared/types/event";
import {
    EVENT_INITIATOR_HEADER,
    parseEventInitiator,
} from "@/api-shared/types/event-history";
import {
    MAX_EVENT_RANGE_DAYS,
    MILLISECONDS_IN_A_DAY,
} from "@/settings";

type ServerApiEventGet = ServerApi<ApiEventGetPayload, ApiEventGetResponse>;
type ServerApiEventUpdate = ServerApi<
    ApiEventUpdatePayload,
    ApiEventUpdateResponse
>;
type ServerApiEventCreate = ServerApi<
    ApiEventCreatePayload,
    ApiEventCreateResponse
>;
type ServerApiEventDelete = ServerApi<
    ApiEventDeletePayload,
    ApiEventDeleteResponse
>;

export const GET: ServerApiEventGet = withApi(async (request) => {
    await requireStaffSession();
    const id = request.nextUrl.searchParams.get("id");
    const ids = request.nextUrl.searchParams.get("ids");
    const rawStartDate = request.nextUrl.searchParams.get("sd");
    const rawEndDate = request.nextUrl.searchParams.get("ed");

    if (!id && ids === null && !(rawStartDate && rawEndDate)) {
        throw new ClientApiError("No id provided!");
    }
    const { controller } = await resolveIterationFromRequest(request);
    if (id) {
        return ApiSuccess(await DbEvent.get(id, undefined, controller));
    } else if (ids !== null) {
        const parsedIds = ids
            .split(",")
            .filter((v) => v.length === 36 || v.length === 24);
        const eventArray = await DbEvent.getMultiple(
            parsedIds,
            undefined,
            controller,
        );
        const eventRecord = eventArray.reduce(
            (prev, ev) => ({ ...prev, [ev.id]: ev }),
            {} as Record<EventId, Partial<DbEventDocument>>,
        );
        return ApiSuccess(eventRecord);
    } else {
        const start = new Date(rawStartDate!);
        const end = new Date(rawEndDate!);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new ClientApiError(
                "תאריך לא תקין — יש לספק startDate ו-endDate תקינים",
            );
        }
        const rangeDays =
            (end.getTime() - start.getTime()) / MILLISECONDS_IN_A_DAY;
        if (rangeDays > MAX_EVENT_RANGE_DAYS || rangeDays < 0) {
            throw new ClientApiError(
                `טווח התאריכים חייב להיות בין 0 ל-${MAX_EVENT_RANGE_DAYS} ימים`,
            );
        }
        // Calendar range loads double as the trigger for pulling Google-side
        // edits back in (throttled per user; no-op when sync isn't linked).
        // Session resolution must never break the read path (e.g. outside a
        // request scope in unit tests).
        const user = await getSessionUser().catch(() => null);
        if (user) pullGoogleEditsInBackground(user.id);
        return ApiSuccess(
            await DbEvent.getInRange(
                start,
                end,
                undefined,
                undefined,
                controller,
            ),
        );
    }
});

export const POST: ServerApiEventUpdate = withApi(async (request) => {
    await requireStaffSession();
    const { controller, iterationId } =
        await resolveWritableIterationFromRequest(request);
    const event: ApiEventUpdatePayload = eventDateFixupToDate(
        await requireJsonObjectBody<DbEventDocument>(request),
    );
    if (!event) {
        throw new ClientApiError("No data provided!");
    }
    const updated = await DbEvent.set(event, undefined, controller, iterationId, {
        initiator: parseEventInitiator(
            request.headers.get(EVENT_INITIATOR_HEADER),
        ),
    });
    syncEventToInstructorsGoogleCalendars(updated, "upsert");
    syncEventLessonToHive(updated, "upsert", controller);
    return ApiSuccess(updated);
});

export const PUT: ServerApiEventCreate = withApi(async (request) => {
    await requireStaffSession();
    const { controller, iterationId } =
        await resolveWritableIterationFromRequest(request);
    const event: ApiEventCreatePayload = eventDateFixupToDate(
        await requireJsonObjectBody<DbEventDocument>(request),
    );
    if (!event) {
        throw new ClientApiError("No data provided!");
    }
    const created = await DbEvent.create(
        event,
        undefined,
        controller,
        iterationId,
        {
            initiator: parseEventInitiator(
                request.headers.get(EVENT_INITIATOR_HEADER),
            ),
        },
    );
    syncEventToInstructorsGoogleCalendars(created, "upsert");
    syncEventLessonToHive(created, "upsert", controller);
    return ApiSuccess(created);
});

export const DELETE: ServerApiEventDelete = withApi(async (request) => {
    await requireStaffSession();
    const { controller, iterationId } =
        await resolveWritableIterationFromRequest(request);
    const eventId: ApiEventDeletePayload = await request.json();
    if (!eventId) {
        throw new ClientApiError("No eventId provided!");
    }
    const existing = await DbEvent.get(eventId, undefined, controller);
    await DbEvent.del(eventId, undefined, controller, iterationId, {
        initiator: parseEventInitiator(
            request.headers.get(EVENT_INITIATOR_HEADER),
        ),
    });
    if (existing) {
        syncEventToInstructorsGoogleCalendars(existing, "delete");
        syncEventLessonToHive(existing, "delete", controller);
    }
    return ApiSuccess();
});
