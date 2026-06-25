import dayjs, { Dayjs } from "dayjs";

import { RoomId, RoomSource } from "@/api-shared/types/room";

export type ReserverType = "instructor" | "outsider";

export type Reservation = {
    _id?: string;
    roomId: RoomId;
    roomSource: RoomSource;
    start: Dayjs;
    end: Dayjs;
    reserverType: ReserverType;
    reserverId: string;
    note?: string;
};

export type DbReservation = Omit<Reservation, "start" | "end"> & {
    start: string;
    end: string;
};

export function reservationDateFixup(reservation: DbReservation): Reservation {
    const result = { ...reservation } as unknown as Reservation;
    result.start = dayjs(reservation.start);
    result.end = dayjs(reservation.end);
    return result;
}

export type ApiReservationsGetPayload = {
    roomId?: RoomId;
    roomSource?: RoomSource;
    from?: string;
    to?: string;
};
export type ApiReservationsGetResponse = Array<DbReservation>;

export type ApiReservationCreatePayload = Omit<DbReservation, "_id">;
export type ApiReservationCreateResponse = DbReservation;

export type ApiReservationDeletePayload = string;
export type ApiReservationDeleteResponse = void;
