export const dynamic = "force-dynamic";

import {
    ApiSuccess,
    parseJsonBody,
    requireJsonObjectBody,
    ServerApi,
    withApi,
} from "@/api-server/common";
import { DbReservations } from "@/api-server/db-reservations";
import {
    resolveIterationFromRequest,
    resolveWritableIterationFromRequest,
} from "@/api-server/iteration-request";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import {
    ApiReservationCreatePayload,
    ApiReservationCreateResponse,
    ApiReservationDeletePayload,
    ApiReservationDeleteResponse,
    ApiReservationsGetPayload,
    ApiReservationsGetResponse,
} from "@/api-shared/types/reservation";

type ServerApiReservationsGet = ServerApi<
    ApiReservationsGetPayload,
    ApiReservationsGetResponse
>;
type ServerApiReservationCreate = ServerApi<
    ApiReservationCreatePayload,
    ApiReservationCreateResponse
>;
type ServerApiReservationDelete = ServerApi<
    ApiReservationDeletePayload,
    ApiReservationDeleteResponse
>;

export const GET: ServerApiReservationsGet = withApi(async (request) => {
    await requireStaffSession();
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId") ?? undefined;
    const roomSourceStr = searchParams.get("roomSource");
    const roomSource =
        roomSourceStr !== null ? Number(roomSourceStr) : undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    const { controller } = await resolveIterationFromRequest(request);
    const reservations = await DbReservations.get(
        roomId,
        roomSource,
        from,
        to,
        controller,
    );
    return ApiSuccess(reservations);
});

export const PUT: ServerApiReservationCreate = withApi(async (request) => {
    await requireStaffSession();
    const { controller } = await resolveWritableIterationFromRequest(request);
    const payload =
        await requireJsonObjectBody<ApiReservationCreatePayload>(request);
    if (!payload.roomId || !payload.start || !payload.end) {
        throw new ClientApiError("נתוני הזמנה חסרים");
    }
    const reservation = await DbReservations.create(payload, controller);
    return ApiSuccess(reservation);
});

export const DELETE: ServerApiReservationDelete = withApi(async (request) => {
    await requireStaffSession();
    const { controller } = await resolveWritableIterationFromRequest(request);
    // The client sends a bare JSON string id here, not an object — parse with
    // the shared helper so a malformed payload is a 400, not a 500.
    const reservationId = parseJsonBody<ApiReservationDeletePayload>(
        await request.text(),
    );
    if (!reservationId) {
        throw new ClientApiError("מזהה הזמנה לא סופק");
    }
    await DbReservations.cancel(reservationId, controller);
    return ApiSuccess();
});
