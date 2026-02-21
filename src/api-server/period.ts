import databaseController from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { periodDateFixup } from "@/api-shared/calendar";
import { ClientApiError } from "@/api-shared/errors";
import { PeriodAddedOrRemovedMessage, PeriodDataUpdateMessage } from "@/api-shared/types";
import { Period } from "@/components/schedule/types/event";
import { MessageTypes } from "@/settings";
import { Filter, FindOptions, ObjectId, WithId } from "mongodb";

function fixId<T extends Partial<Period>>(period: T & WithId<Period>): Partial<Period> & { id: string; }
{
    if (period._id)
    {
        period.id = period._id.toHexString();
        delete (period as Partial<WithId<Period>>)._id;
    }
    return period as T & { id: string; };
}

async function getDbPeriod(periodId: string, options?: FindOptions)
{
    const data: WithId<Period> | null = await databaseController.periods.findOne({ '_id': new ObjectId(periodId) }, options);
    if (data) { return periodDateFixup(fixId(data)); }
    return data;
}

async function getDbPeriodsInRange(startDate: Date, endDate: Date, options?: FindOptions, filter?: Filter<Period>)
{
    const data = databaseController.periods.find({ startTime: { '$gte': startDate }, endTime: { '$lte': endDate }, ...filter }, options);
    return data.map((p: WithId<Period>) => { return periodDateFixup(fixId(p)); }).toArray();
}

async function setDbPeriod(period: Partial<Period>, options?: FindOptions): Promise<Period>
{
    if (!period.id && !period.name) { throw new ClientApiError('Period name or id is missing!'); }

    period = periodDateFixup(period);

    if (period.id === undefined)
    {
        const data = await databaseController.periods.insertOne(period as Period, options);
        if (data.insertedId === null) { throw new ClientApiError('Failed to insert period!'); }
        period.id = data.insertedId.toHexString();
        delete (period as Partial<WithId<Period>>)._id;
        SendServerRequestToSessionServer(MessageTypes.PERIOD_ADDED_OR_REMOVED, { action: 'added', newData: period, periodId: period.id } as PeriodAddedOrRemovedMessage);
        databaseController.periods.updateOne({ '_id': new ObjectId(period.id) }, { '$set': { id: period.id } }, options); // Set the id field to the same value as _id for easier querying
        return period as Period;
    }
    else
    {
        const periodId = period.id;
        delete period.id;
        const data = await databaseController.periods.updateOne({ '_id': new ObjectId(periodId) }, { '$set': period }, options);
        if (data.matchedCount === 0)
        {
            throw new ClientApiError(`No period by id ${periodId} found!`);
        }
        if (data.modifiedCount === 0)
        {
            throw new ClientApiError(`Period ${periodId} data not modified!`);
        }

        period = fixId(period as WithId<Period>);
        SendServerRequestToSessionServer(MessageTypes.PERIOD_DATA_UPDATE, { periods: { [ periodId ]: period } } as PeriodDataUpdateMessage);
        return period as Period;
    }
}

async function deleteDbPeriod(periodId: Period[ 'id' ], options?: FindOptions)
{
    if (!periodId) { throw new ClientApiError('Period id is missing!'); }

    const data = await databaseController.periods.deleteOne({ '_id': new ObjectId(periodId) });
    if (data.deletedCount === 0) { throw new ClientApiError('Failed to delete period!'); }
    SendServerRequestToSessionServer(MessageTypes.PERIOD_ADDED_OR_REMOVED, { action: 'removed', periodId } as PeriodAddedOrRemovedMessage);
}

export namespace DbPeriod
{
    export const get = getDbPeriod;
    export const getInRange = getDbPeriodsInRange;
    export const set = setDbPeriod;
    export const del = deleteDbPeriod;
}
