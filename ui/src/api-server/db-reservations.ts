import { ObjectId } from "mongodb";

import {
    databaseController,
    DatabaseController,
} from "@/api-server/mongo-db-controller";
import { withOptionalTransaction } from "@/api-server/mongo-transactions";
import { ClientApiError } from "@/api-shared/errors";
import { DbReservation } from "@/api-shared/types/reservation";
import { RoomId, RoomSource } from "@/api-shared/types/room";

async function getReservations(
    roomId?: RoomId,
    roomSource?: RoomSource,
    from?: string,
    to?: string,
    controller: DatabaseController = databaseController,
): Promise<Array<DbReservation>> {
    const filter: Record<string, any> = {};
    if (roomId !== undefined) filter.roomId = roomId;
    if (roomSource !== undefined) filter.roomSource = roomSource;
    if (from || to) {
        filter.start = {};
        if (from) filter.start.$gte = from;
        if (to) filter.start.$lte = to;
    }
    const docs = await controller.reservations.find(filter).toArray();
    return docs.map((doc) => ({ ...doc, _id: doc._id?.toString() }));
}

async function createReservation(
    reservation: Omit<DbReservation, "_id">,
    controller: DatabaseController = databaseController,
): Promise<DbReservation> {
    // Raw `withTransaction` throws outright on a standalone mongod, which is
    // exactly the deployment `withOptionalTransaction` exists for: every
    // reservation creation failed there (#516, same defect family as #435).
    return await withOptionalTransaction(
        controller.client,
        async (session) => {
            const conflict = await controller.reservations.findOne(
                {
                    roomId: reservation.roomId,
                    roomSource: reservation.roomSource,
                    start: { $lt: reservation.end },
                    end: { $gt: reservation.start },
                },
                { session },
            );
            if (conflict) {
                throw new ClientApiError(
                    "החדר כבר מוזמן בטווח הזמן המבוקש",
                );
            }
            const result = await controller.reservations.insertOne(
                reservation as DbReservation,
                { session },
            );
            return { ...reservation, _id: result.insertedId.toString() };
        },
        "createReservation",
    );
}

async function cancelReservation(
    reservationId: string,
    controller: DatabaseController = databaseController,
): Promise<void> {
    // `_id` is a real ObjectId in Mongo; reads stringify it on the way out,
    // so the id coming back in has to be rehydrated or the delete matches
    // nothing and reports "not found" for a reservation that exists.
    if (!ObjectId.isValid(reservationId)) {
        throw new ClientApiError(`לא נמצאה הזמנה עם מזהה ${reservationId}`);
    }
    const result = await controller.reservations.deleteOne({
        _id: new ObjectId(reservationId),
    } as never);
    if (result.deletedCount === 0) {
        throw new ClientApiError(`לא נמצאה הזמנה עם מזהה ${reservationId}`);
    }
}

export namespace DbReservations {
    export const get = getReservations;
    export const create = createReservation;
    export const cancel = cancelReservation;
}
