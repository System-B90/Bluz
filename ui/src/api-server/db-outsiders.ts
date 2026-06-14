import { FindOptions, UpdateOptions } from "mongodb";

import { databaseController } from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { ClientApiError } from "@/api-shared/errors";
import { Outsider } from "@/api-shared/types/outsider";
import { MessageTypes } from "@/settings";

async function getDbOutsiders(options?: FindOptions): Promise<Array<Outsider>> {
    const data = databaseController.outsiders.find({}, options);
    return await data.toArray();
}

async function setDbOutsider(outsider: Outsider, options?: UpdateOptions) {
    const { _id: _, id: outsiderId, ...outsiderData } = outsider as any;
    const data = await databaseController.outsiders.updateOne(
        { id: outsiderId },
        { $set: outsiderData },
        options,
    );
    if (data.matchedCount === 0 && !options?.upsert) {
        throw new ClientApiError(`No outsider by id ${outsiderId} found!`);
    }
    SendServerRequestToSessionServer(MessageTypes.OUTSIDERS_UPDATE as any, {
        outsiders: { [outsiderId]: outsider },
    });
}

async function createDbOutsider(outsider: Outsider) {
    await databaseController.outsiders.insertOne(outsider as Outsider);
    SendServerRequestToSessionServer(MessageTypes.OUTSIDERS_UPDATE as any, {
        outsiders: { [outsider.id]: outsider },
    });
    return outsider;
}

async function deleteDbOutsider(outsiderId: Outsider["id"]) {
    const data = await databaseController.outsiders.deleteOne({ id: outsiderId });
    if (data.deletedCount === 0) {
        throw new ClientApiError(`No outsider by id ${outsiderId} found!`);
    }
    SendServerRequestToSessionServer(MessageTypes.OUTSIDERS_UPDATE as any, {
        outsiders: { [outsiderId]: null },
    });
}

export namespace DbOutsiders {
  export const get = getDbOutsiders;
  export const set = setDbOutsider;
  export const create = createDbOutsider;
  export const del = deleteDbOutsider;
}
