export const dynamic = "force-dynamic";

import { ApiSuccess, catchHandler, ServerApi } from "@/api-server/common";
import { DbReservations } from "@/api-server/db-reservations";
import {
    resolveIterationFromRequest,
    resolveWritableIterationFromRequest,
} from "@/api-server/iteration-request";
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

export const GET: ServerApiReservationsGet = async (request) => {
    try {
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
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const PUT: ServerApiReservationCreate = async (request) => {
    try {
        const { controller } =
            await resolveWritableIterationFromRequest(request);
        const payload = await request.json();
        if (!payload || !payload.roomId || !payload.start || !payload.end) {
            throw new ClientApiError("נתוני הזמנה חסרים");
        }
        const reservation = await DbReservations.create(payload, controller);
        return ApiSuccess(reservation);
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const DELETE: ServerApiReservationDelete = async (request) => {
    try {
        const { controller } =
            await resolveWritableIterationFromRequest(request);
        const reservationId = await request.json();
        if (!reservationId) {
            throw new ClientApiError("מזהה הזמנה לא סופק");
        }
        await DbReservations.cancel(reservationId, controller);
        return ApiSuccess();
    } catch (e) {
        return catchHandler(request, e);
    }
};
