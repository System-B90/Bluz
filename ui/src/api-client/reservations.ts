import {
    ClientApi,
    safeApiFetcher,
} from "@/api-client/common";
import {
    ApiReservationCreatePayload,
    ApiReservationCreateResponse,
    ApiReservationDeletePayload,
    ApiReservationDeleteResponse,
    ApiReservationsGetPayload,
    ApiReservationsGetResponse,
    Reservation,
    reservationDateFixup,
} from "@/api-shared/types/reservation";

export async function apiGetReservations(
    payload?: ApiReservationsGetPayload,
    props?: RequestInit,
): Promise<Array<Reservation>> {
    const params = new URLSearchParams();
    if (payload?.roomId !== undefined)
        params.set("roomId", String(payload.roomId));
    if (payload?.roomSource !== undefined)
        params.set("roomSource", String(payload.roomSource));
    if (payload?.from) params.set("from", payload.from);
    if (payload?.to) params.set("to", payload.to);
    const query = params.toString() ? `?${params.toString()}` : "";
    const rawData = await safeApiFetcher<ApiReservationsGetResponse>(
        `/api/reservations${query}`,
        props,
    );
    return rawData.map(reservationDateFixup);
}

type ClientApiCreateReservation = ClientApi<
    ApiReservationCreatePayload,
    Reservation
>;
type ClientApiDeleteReservation = ClientApi<
    ApiReservationDeletePayload,
    ApiReservationDeleteResponse
>;

export const apiCreateReservation: ClientApiCreateReservation = async (
    reservation,
    props,
) => {
    const rawData = await safeApiFetcher<ApiReservationCreateResponse>(
        "/api/reservations",
        {
            ...props,
            method: "PUT",
            body: JSON.stringify(reservation),
        },
    );
    return reservationDateFixup(rawData);
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
