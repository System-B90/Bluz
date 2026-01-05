import databaseController from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { dateFixup } from "@/api-shared/calendar";
import { ClientApiError } from "@/api-shared/errors";
import { PeriodAddedOrRemovedMessage, PeriodDataUpdateMessage } from "@/api-shared/types";
import { Period } from "@/components/schedule/types/event";
import { MessageTypes } from "@/settings";
import { FindOptions, ObjectId, WithId } from "mongodb";

async function getDbPeriod(periodId: string, options?: FindOptions)
{
    const data: WithId<Period> | null = await databaseController.periods.findOne({ '_id': new ObjectId(periodId) }, options);
    if (data)
    {
        data.id = data._id.toHexString();
    }
    return data;
}

async function getDbPeriodsInRange(startDate: Date, endDate: Date, options?: FindOptions)
{
    const data = await databaseController.periods.find({ startTime: { '$gte': startDate }, endTime: { '$lte': endDate } }, options);
    return data.map((p: WithId<Period>) => { p.id = p._id.toHexString(); return p; }).toArray();
}

async function setDbPeriod(period: Partial<Period>, options?: FindOptions)
{
    if (!period.id && !period.name) { throw new ClientApiError('Period name or id is missing!'); }

    period = dateFixup(period);

    if (period.id === undefined)
    {
        const data = await databaseController.periods.insertOne(period as Period, options);
        if (data.insertedId === null) { throw new ClientApiError('Failed to insert period!'); }
        period.id = data.insertedId.toHexString();
        SendServerRequestToSessionServer(MessageTypes.PERIOD_ADDED_OR_REMOVED, { action: 'added', newData: period, periodId: period.id } as PeriodAddedOrRemovedMessage);
        return period;
    }
    else
    {
        const periodId = period.id;
        period.id = undefined;
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
        period.id = periodId;
        SendServerRequestToSessionServer(MessageTypes.PERIOD_DATA_UPDATE, { periods: { [ periodId ]: period } } as PeriodDataUpdateMessage);
        return period;
    }
}

export namespace DbPeriod
{
    export const get = getDbPeriod;
    export const set = setDbPeriod;
    export const getInRange = getDbPeriodsInRange;
}
