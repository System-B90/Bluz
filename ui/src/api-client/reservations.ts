import {
    ClientApi,
    ClientApiNoPayload,
    safeApiFetcher,
} from "@/api-client/common";
import {
    ApiReservationCreatePayload,
    ApiReservationCreateResponse,
    ApiReservationDeletePayload,
    ApiReservationDeleteResponse,
    ApiReservationsGetPayload,
    ApiReservationsGetResponse,
} from "@/api-shared/types/reservation";
import { RoomSource } from "@/api-shared/types/room";

type ClientApiGetReservations = ClientApi<
    ApiReservationsGetPayload,
    ApiReservationsGetResponse
>;
type ClientApiCreateReservation = ClientApi<
    ApiReservationCreatePayload,
    ApiReservationCreateResponse
>;
type ClientApiDeleteReservation = ClientApi<
    ApiReservationDeletePayload,
    ApiReservationDeleteResponse
>;

export const apiGetReservations: ClientApiGetReservations = async (
    payload,
    props,
) => {
    const params = new URLSearchParams();
    if (payload?.roomId !== undefined)
        params.set("roomId", String(payload.roomId));
    if (payload?.roomSource !== undefined)
        params.set("roomSource", String(payload.roomSource));
    if (payload?.from) params.set("from", payload.from);
    if (payload?.to) params.set("to", payload.to);
    const query = params.toString() ? `?${params.toString()}` : "";
    return await safeApiFetcher<ApiReservationsGetResponse>(
        `/api/reservations${query}`,
        props,
    );
};

export const apiCreateReservation: ClientApiCreateReservation = async (
    reservation,
    props,
) => {
    return await safeApiFetcher<ApiReservationCreateResponse>(
        "/api/reservations",
        {
            ...props,
            method: "PUT",
            body: JSON.stringify(reservation),
        },
    );
};

export const apiCancelReservation: ClientApiDeleteReservation = async (
    reservationId,
    props,
) => {
    await safeApiFetcher<ApiReservationDeleteResponse>("/api/reservations", {
        ...props,
        method: "DELETE",
        body: JSON.stringify(reservationId),
    });
};
