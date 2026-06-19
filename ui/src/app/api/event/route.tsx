export const dynamic = "force-dynamic";

import { ApiSuccess, catchHandler, ServerApi } from "@/api-server/common";
import { DbEvent } from "@/api-server/db-event";
import { eventDateFixup } from "@/api-shared/calendar";
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

export const GET: ServerApiEventGet = async (request) => {
    try {
        const id = request.nextUrl.searchParams.get("id");
        const ids = request.nextUrl.searchParams.get("ids");
        const rawStartDate = request.nextUrl.searchParams.get("sd");
        const rawEndDate = request.nextUrl.searchParams.get("ed");

        if (!id && ids === null && !(rawStartDate && rawEndDate)) {
            throw new ClientApiError("No id provided!");
        }
        if (id) {
            return ApiSuccess(await DbEvent.get(id));
        } else if (ids !== null) {
            const parsedIds = ids
                .split(",")
                .filter((v) => v.length === 36 || v.length === 24);
            const eventArray = await DbEvent.getMultiple(parsedIds);
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
            const MAX_RANGE_DAYS = 366;
            const rangeDays =
                (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
            if (rangeDays > MAX_RANGE_DAYS || rangeDays < 0) {
                throw new ClientApiError(
                    `טווח התאריכים חייב להיות בין 0 ל-${MAX_RANGE_DAYS} ימים`,
                );
            }
            return ApiSuccess(await DbEvent.getInRange(start, end));
        }
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const POST: ServerApiEventUpdate = async (request) => {
    try {
        const event: ApiEventUpdatePayload = eventDateFixup(
            await request.json(),
        );
        if (!event) {
            throw new ClientApiError("No data provided!");
        }
        return ApiSuccess(await DbEvent.set(event));
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const PUT: ServerApiEventCreate = async (request) => {
    try {
        const event: ApiEventCreatePayload = eventDateFixup(
            await request.json(),
        );
        if (!event) {
            throw new ClientApiError("No data provided!");
        }
        return ApiSuccess(await DbEvent.create(event));
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const DELETE: ServerApiEventDelete = async (request) => {
    try {
        const eventId: ApiEventDeletePayload = await request.json();
        if (!eventId) {
            throw new ClientApiError("No eventId provided!");
        }
        await DbEvent.del(eventId);
        return ApiSuccess();
    } catch (e) {
        return catchHandler(request, e);
    }
};
