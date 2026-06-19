import { ObjectId } from "mongodb";

import { databaseController } from "@/api-server/mongo-db-controller";
import { ClientApiError } from "@/api-shared/errors";
import { Reservation } from "@/api-shared/types/reservation";
import { RoomId, RoomSource } from "@/api-shared/types/room";

async function getReservations(
    roomId?: RoomId,
    roomSource?: RoomSource,
    from?: string,
    to?: string,
): Promise<Array<Reservation>> {
    const filter: Record<string, any> = {};
    if (roomId !== undefined) filter.roomId = roomId;
    if (roomSource !== undefined) filter.roomSource = roomSource;
    if (from || to) {
        filter.start = {};
        if (from) filter.start.$gte = from;
        if (to) filter.start.$lte = to;
    }
    const docs = await databaseController.reservations.find(filter).toArray();
    return docs.map((doc) => ({ ...doc, _id: doc._id?.toString() }));
}

async function createReservation(
    reservation: Omit<Reservation, "_id">,
): Promise<Reservation> {
    // Conflict detection: reject if any reservation overlaps for same room
    const conflict = await databaseController.reservations.findOne({
        roomId: reservation.roomId,
        roomSource: reservation.roomSource,
        start: { $lt: reservation.end },
        end: { $gt: reservation.start },
    });
    if (conflict) {
        throw new ClientApiError(
            "החדר כבר מוזמן בטווח הזמן המבוקש",
        );
    }
    const result = await databaseController.reservations.insertOne(
        reservation as any,
    );
    return { ...reservation, _id: result.insertedId.toString() };
}

async function cancelReservation(reservationId: string): Promise<void> {
    const result = await databaseController.reservations.deleteOne({
        _id: new ObjectId(reservationId),
    });
    if (result.deletedCount === 0) {
        throw new ClientApiError(`לא נמצאה הזמנה עם מזהה ${reservationId}`);
    }
}

export namespace DbReservations {
    export const get = getReservations;
    export const create = createReservation;
    export const cancel = cancelReservation;
}
