import { Filter, FindOptions } from "mongodb";

import { databaseController } from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { eventDateFixup } from "@/api-shared/calendar";
import { ClientApiError } from "@/api-shared/errors";
import {
    EventAddedOrRemovedMessage,
    EventDataUpdateMessage,
} from "@/api-shared/types";
import { Event, EventId } from "@/components/schedule/types/event";
import { MessageTypes } from "@/settings";

// No more ObjectId! We only need this if MongoDB still stores Date objects and you use Dayjs
export type DbEventDocument = Omit<Event, "endTime" | "startTime"> & {
  startTime: Date;
  endTime: Date;
};

async function getDbEvent(
    eventId: EventId,
    options?: FindOptions,
): Promise<DbEventDocument | null> {
    const data = await databaseController.events.findOne(
        { id: eventId },
        options,
    );
    return data ? data : null;
}

async function getDbEvents(
    eventIds: Array<EventId>,
    options?: FindOptions,
): Promise<Array<DbEventDocument>> {
    const cursor = databaseController.events.find(
        { id: { $in: eventIds } },
        options,
    );
    const data = await cursor.toArray();
    return data;
}

async function getDbEventsInRange(
    startDate: Date,
    endDate: Date,
    options?: FindOptions,
    filter?: Filter<DbEventDocument>,
): Promise<Array<DbEventDocument>> {
    const cursor = databaseController.events.find(
        { startTime: { $gte: startDate }, endTime: { $lte: endDate }, ...filter },
        options,
    );
    const data = await cursor.toArray();
    return data;
}

/**
 * Updates an existing calendar event in the MongoDB collection.
 * Triggers a real-time WebSocket broadcast to all connected clients.
 * 
 * @param eventData The document payload sent by the client. Must contain a valid `id` UUID.
 * @param options MongoDB FindOptions.
 * @returns The fixed and serialized DbEventDocument.
 * @throws ClientApiError if the event ID is missing or the event is not found in the database.
 * @example
 * ```typescript
 * const updated = await DbEvent.set(eventPayload);
 * ```
 */
async function setDbEvent(
    eventData: DbEventDocument,
    options?: FindOptions,
): Promise<DbEventDocument> {
    if (!eventData.id) {
        throw new ClientApiError(
            "Event id is missing! Client must provide a UUID.",
        );
    }

    const fixedEvent = eventDateFixup(eventData);
    const { id: eventId, ...updatePayload } = fixedEvent;

    // Because the client generates the ID, we don't inherently know if this is new or an update.
    // So, we try to update it first.
    const updateResult = await databaseController.events.updateOne(
        { id: eventId },
        { $set: updatePayload },
        options,
    );

    // Verify the document exists in MongoDB. Using matchedCount ensures we don't throw an
    // error if the user clicks Save without changing any fields (modifiedCount would be 0).
    if (updateResult.matchedCount === 0) {
        throw new ClientApiError(`Event ${eventId} not found!`);
    }

    SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE, {
        events: { [eventId]: fixedEvent },
    } as EventDataUpdateMessage<DbEventDocument>);

    return fixedEvent;
}

/**
 * Inserts a new calendar event into the MongoDB collection.
 * Triggers a real-time WebSocket broadcast to notify clients of the new event.
 * 
 * @param eventData The document payload sent by the client. Must contain a valid `id` UUID.
 * @param options MongoDB FindOptions.
 * @returns The fixed, created DbEventDocument.
 * @throws ClientApiError if the event ID is missing.
 * @example
 * ```typescript
 * const newEvent = await DbEvent.create(eventPayload);
 * ```
 */
async function createDbEvent(
    eventData: DbEventDocument,
    options?: FindOptions,
): Promise<DbEventDocument> {
    if (!eventData.id) {
        throw new ClientApiError(
            "Event id is missing! Client must provide a UUID.",
        );
    }

    const { id: eventId, ...updatePayload } = eventData;
    
    // Fix dates and explicitly preserve the client-generated UUID in the id field
    const fixedEvent = {
        ...eventDateFixup(updatePayload),
        id: eventId,
    };

    await databaseController.events.insertOne(fixedEvent as any, options);

    SendServerRequestToSessionServer(MessageTypes.EVENT_ADDED_OR_REMOVED, {
        action: "added",
        newData: fixedEvent,
        eventId: eventId,
    } as EventAddedOrRemovedMessage<DbEventDocument>);

    return fixedEvent as DbEventDocument;
}

async function deleteDbEvent(
    eventId: string,
    options?: FindOptions,
): Promise<void> {
    if (!eventId) {
        throw new ClientApiError("Event id is missing!");
    }

    const data = await databaseController.events.deleteOne(
        { id: eventId },
        options,
    );

    if (data.deletedCount === 0) {
        throw new ClientApiError("Failed to delete event!");
    }

    SendServerRequestToSessionServer(MessageTypes.EVENT_ADDED_OR_REMOVED, {
        action: "removed",
        eventId: eventId,
    } as EventAddedOrRemovedMessage<DbEventDocument>);
}

export namespace DbEvent {
  export const get = getDbEvent;
  export const getMultiple = getDbEvents;
  export const getInRange = getDbEventsInRange;
  export const set = setDbEvent;
  export const del = deleteDbEvent;
  export const create = createDbEvent;
}
