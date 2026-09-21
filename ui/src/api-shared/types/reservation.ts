import type { Dayjs } from "dayjs";

import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
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

export type DbReservation = Omit<Reservation, "end" | "start"> & {
    end: string;
    start: string;
};

export function reservationDateFixup(reservation: DbReservation): Reservation {
    const result = { ...reservation } as unknown as Reservation;
    // Same Israel-wall-clock rule as `eventDateFixupToDayjs` (#168): a
    // reservation must not shift by the viewer's browser offset.
    result.start = dayjs(reservation.start).tz(APP_TIMEZONE);
    result.end = dayjs(reservation.end).tz(APP_TIMEZONE);
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
