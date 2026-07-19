import {
    databaseController,
    DatabaseController,
} from "@/api-server/mongo-db-controller";
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
    const session = controller.client.startSession();
    try {
        let created: DbReservation | null = null;
        await session.withTransaction(async () => {
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
            created = { ...reservation, _id: result.insertedId.toString() };
        });
        return created!;
    } finally {
        await session.endSession();
    }
}

async function cancelReservation(
    reservationId: string,
    controller: DatabaseController = databaseController,
): Promise<void> {
    const result = await controller.reservations.deleteOne({
        _id: reservationId,
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
