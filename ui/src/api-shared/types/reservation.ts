import { RoomId, RoomSource } from "@/api-shared/types/room";

export type ReserverType = "instructor" | "outsider";

export type Reservation = {
    _id?: string;
    roomId: RoomId;
    roomSource: RoomSource;
    start: string; // ISO string
    end: string; // ISO string
    reserverType: ReserverType;
    reserverId: string;
    note?: string;
};

export type ApiReservationsGetPayload = {
    roomId?: RoomId;
    roomSource?: RoomSource;
    from?: string; // ISO string
    to?: string; // ISO string
};
export type ApiReservationsGetResponse = Array<Reservation>;

export type ApiReservationCreatePayload = Omit<Reservation, "_id">;
export type ApiReservationCreateResponse = Reservation;

export type ApiReservationDeletePayload = string; // _id
export type ApiReservationDeleteResponse = void;
