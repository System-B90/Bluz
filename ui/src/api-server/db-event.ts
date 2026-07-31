import { Filter, FindOptions } from "mongodb";

import {
    databaseController,
    DatabaseController,
} from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { extendEndPastBreaks } from "@/api-shared/break-split";
import { eventDateFixup } from "@/api-shared/calendar";
import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
import { ClientApiError } from "@/api-shared/errors";
import {
    EventAddedOrRemovedMessage,
    EventDataUpdateMessage,
} from "@/api-shared/types";
import { DbEventDocument, EventId, EventType } from "@/api-shared/types/event";
import { IterationId } from "@/api-shared/types/iteration";
import { MessageTypes } from "@/settings";

export type { DbEventDocument };

// Soft-deleted (archived) events must never surface in active views. Every read
// path folds this predicate into its Mongo filter.
const NOT_ARCHIVED: Filter<DbEventDocument> = { archived: { $ne: true } };

async function getDbEvent(
    eventId: EventId,
    options?: FindOptions,
    controller: DatabaseController = databaseController,
): Promise<DbEventDocument | null> {
    const data = await controller.events.findOne(
        { id: eventId, ...NOT_ARCHIVED },
        options,
    );
    return data ? data : null;
}

async function getDbEvents(
    eventIds: Array<EventId>,
    options?: FindOptions,
    controller: DatabaseController = databaseController,
): Promise<Array<DbEventDocument>> {
    const cursor = controller.events.find(
        { id: { $in: eventIds }, ...NOT_ARCHIVED },
        options,
    );
    const data = await cursor.toArray();
    return data;
}

const EVENT_RANGE_LIMIT = 10_000;

async function getDbEventsInRange(
    startDate: Date,
    endDate: Date,
    options?: FindOptions,
    filter?: Filter<DbEventDocument>,
    controller: DatabaseController = databaseController,
): Promise<Array<DbEventDocument>> {
    const cursor = controller.events
        .find(
            {
                startTime: { $gte: startDate },
                endTime: { $lte: endDate },
                ...NOT_ARCHIVED,
                ...filter,
            },
            options,
        )
        .limit(EVENT_RANGE_LIMIT);
    const data = await cursor.toArray();
    return data;
}

/**
 * When `splitAcrossBreaks` is set, pushes the event's `endTime` past any
 * same-day break (הפסקה) event it overlaps, so its working duration survives
 * the break instead of being eaten by it. No-op for break events themselves
 * or when the flag is off.
 */
async function applySplitAcrossBreaks(
    eventData: DbEventDocument,
    controller: DatabaseController,
): Promise<DbEventDocument> {
    if (!eventData.splitAcrossBreaks || eventData.type === EventType.BREAK) {
        return eventData;
    }

    // Day boundaries must be computed in the app's wall-clock timezone, not
    // the server process's local timezone (typically UTC in prod) — otherwise
    // an event near Israel midnight can miss/misjudge same-day breaks.
    const dayStart = dayjs(eventData.startTime).tz(APP_TIMEZONE).startOf("day").toDate();
    const dayEnd = dayjs(dayStart).tz(APP_TIMEZONE).add(1, "day").toDate();

    const breakDocs = await controller.events
        .find({
            type: EventType.BREAK,
            startTime: { $lt: dayEnd },
            endTime: { $gt: dayStart },
            ...NOT_ARCHIVED,
        })
        .toArray();

    if (breakDocs.length === 0) return eventData;

    const endTime = extendEndPastBreaks(
        eventData.startTime,
        eventData.endTime,
        breakDocs.map((b) => ({ start: b.startTime, end: b.endTime })),
    );

    return { ...eventData, endTime };
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
    controller: DatabaseController = databaseController,
    iterationId?: IterationId,
): Promise<DbEventDocument> {
    if (!eventData.id) {
        throw new ClientApiError(
            "Event id is missing! Client must provide a UUID.",
        );
    }

    const splitEvent = await applySplitAcrossBreaks(eventData, controller);
    const fixedEvent = eventDateFixup(splitEvent);
    const { id: eventId, ...updatePayload } = fixedEvent;

    // Because the client generates the ID, we don't inherently know if this is new or an update.
    // So, we try to update it first.
    const updateResult = await controller.events.updateOne(
        { id: eventId, ...NOT_ARCHIVED },
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
        iterationId,
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
    controller: DatabaseController = databaseController,
    iterationId?: IterationId,
): Promise<DbEventDocument> {
    if (!eventData.id) {
        throw new ClientApiError(
            "Event id is missing! Client must provide a UUID.",
        );
    }

    const splitEvent = await applySplitAcrossBreaks(eventData, controller);
    const { id: eventId, ...updatePayload } = splitEvent;

    // Fix dates and explicitly preserve the client-generated UUID in the id field
    const fixedEvent = {
        ...eventDateFixup(updatePayload),
        id: eventId,
    };

    await controller.events.insertOne(fixedEvent as any, options);

    SendServerRequestToSessionServer(MessageTypes.EVENT_ADDED_OR_REMOVED, {
        action: "added",
        newData: fixedEvent,
        eventId: eventId,
        iterationId,
    } as EventAddedOrRemovedMessage<DbEventDocument>);

    return fixedEvent as DbEventDocument;
}

/**
 * Soft-deletes a calendar event by setting its `archived` flag rather than
 * removing the document. Archived events are filtered out of every read path,
 * so to clients this is indistinguishable from a hard delete — but the record
 * is preserved for auditing/restore. The real-time broadcast still uses the
 * "removed" action so connected clients drop it from their views.
 */
async function deleteDbEvent(
    eventId: string,
    options?: FindOptions,
    controller: DatabaseController = databaseController,
    iterationId?: IterationId,
): Promise<void> {
    if (!eventId) {
        throw new ClientApiError("Event id is missing!");
    }

    const data = await controller.events.updateOne(
        { id: eventId, ...NOT_ARCHIVED },
        { $set: { archived: true } },
        options,
    );

    if (data.matchedCount === 0) {
        throw new ClientApiError("Failed to delete event!");
    }

    SendServerRequestToSessionServer(MessageTypes.EVENT_ADDED_OR_REMOVED, {
        action: "removed",
        eventId: eventId,
        iterationId,
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
