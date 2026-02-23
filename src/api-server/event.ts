import databaseController from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { eventDateFixup } from "@/api-shared/calendar";
import { ClientApiError } from "@/api-shared/errors";
import { EventAddedOrRemovedMessage, EventDataUpdateMessage } from "@/api-shared/types";
import { Event, EventId } from "@/components/schedule/types/event";
import { MessageTypes } from "@/settings";
import { Filter, FindOptions, ObjectId, WithId } from "mongodb";

export function fixId<T extends Partial<K>, K extends { id: string; }>(item: T & WithId<K>): T & { id: string; }
{
    if (item._id)
    {
        item.id = item._id.toHexString();
        delete (item as Partial<WithId<K>>)._id;
    }
    return item as T & { id: string; };
}

async function getDbEvent(eventId: string, options?: FindOptions)
{
    const data: WithId<Event> | null = await databaseController.events.findOne({ '_id': new ObjectId(eventId) }, options);
    if (data) { return eventDateFixup(fixId(data)); }
    return data;
}

async function getDbEvents(eventIds: Array<EventId>, options?: FindOptions): Promise<Array<Partial<Event> & { id: EventId; }>>
{
    const processedIds = eventIds.map((id) => new ObjectId(id));
    const cursor = databaseController.events.find({ '_id': { '$in': processedIds } }, options);
    const data = (await cursor.toArray()).map((ev) => eventDateFixup(fixId(ev)));
    return data;
}

async function getDbEventsInRange(startDate: Date, endDate: Date, options?: FindOptions, filter?: Filter<Event>)
{
    const data = databaseController.events.find({ startTime: { '$gte': startDate }, endTime: { '$lte': endDate }, ...filter }, options);
    return data.map((p: WithId<Event>) => { return eventDateFixup(fixId(p)); }).toArray();
}

async function setDbEvent(event: Partial<Event>, options?: FindOptions): Promise<Event>
{
    if (!event.id && !event.name) { throw new ClientApiError('Event name or id is missing!'); }

    event = eventDateFixup(event);

    if (event.id === undefined)
    {
        const data = await databaseController.events.insertOne(event as Event, options);
        if (data.insertedId === null) { throw new ClientApiError('Failed to insert event!'); }
        event.id = data.insertedId.toHexString();
        delete (event as Partial<WithId<Event>>)._id;
        SendServerRequestToSessionServer(MessageTypes.EVENT_ADDED_OR_REMOVED, { action: 'added', newData: event, eventId: event.id } as EventAddedOrRemovedMessage);
        databaseController.events.updateOne({ '_id': new ObjectId(event.id) }, { '$set': { id: event.id } }, options); // Set the id field to the same value as _id for easier querying
        return event as Event;
    }
    else
    {
        const eventId = event.id;
        delete event.id;
        const data = await databaseController.events.updateOne({ '_id': new ObjectId(eventId) }, { '$set': event }, options);
        if (data.matchedCount === 0)
        {
            throw new ClientApiError(`No event by id ${eventId} found!`);
        }
        if (data.modifiedCount === 0)
        {
            throw new ClientApiError(`Event ${eventId} data not modified!`);
        }

        event = fixId(event as WithId<Event>);
        SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE, { events: { [ eventId ]: event } } as EventDataUpdateMessage);
        return event as Event;
    }
}

async function deleteDbEvent(eventId: EventId, options?: FindOptions)
{
    if (!eventId) { throw new ClientApiError('Event id is missing!'); }

    const data = await databaseController.events.deleteOne({ '_id': new ObjectId(eventId) });
    if (data.deletedCount === 0) { throw new ClientApiError('Failed to delete event!'); }
    SendServerRequestToSessionServer(MessageTypes.EVENT_ADDED_OR_REMOVED, { action: 'removed', eventId } as EventAddedOrRemovedMessage);
}

export namespace DbEvent
{
    export const get = getDbEvent;
    export const getMultiple = getDbEvents;
    export const getInRange = getDbEventsInRange;
    export const set = setDbEvent;
    export const del = deleteDbEvent;
}
