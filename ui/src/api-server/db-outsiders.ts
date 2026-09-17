import { FindOptions, UpdateOptions } from "mongodb";

import { pickFields } from "@/api-server/common";
import {
    databaseController,
    DatabaseController,
} from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { ClientApiError } from "@/api-shared/errors";
import { Outsider } from "@/api-shared/types/outsider";
import { MessageTypes } from "@/settings";

// Client payloads are copied field-by-field, so the document shape is an
// explicit allow-list rather than whatever the caller sent (#538 item 4).
const OUTSIDER_FIELDS = [
    "id",
    "name",
    "phone",
    "personalNumber",
    "idNumber",
    "releaseDate",
    "comment",
] as const;

async function getDbOutsiders(
    options?: FindOptions,
    controller: DatabaseController = databaseController,
): Promise<Array<Outsider>> {
    const data = controller.outsiders.find({}, options);
    return await data.toArray();
}

async function setDbOutsider(
    outsider: Outsider,
    options?: UpdateOptions,
    controller: DatabaseController = databaseController,
) {
    // Same allow-list as create: the payload is client-supplied (#538 item 4).
    const { id: outsiderId, ...outsiderData } = pickFields(
        outsider,
        OUTSIDER_FIELDS,
    );
    const data = await controller.outsiders.updateOne(
        { id: outsiderId },
        { $set: outsiderData },
        options,
    );
    if (data.matchedCount === 0 && !options?.upsert) {
        throw new ClientApiError(`No outsider by id ${outsiderId} found!`);
    }
    SendServerRequestToSessionServer(MessageTypes.OUTSIDERS_UPDATE, {
        outsiders: { [outsiderId]: outsider },
    });
}

async function createDbOutsider(
    outsider: Outsider,
    controller: DatabaseController = databaseController,
) {
    const document = pickFields(outsider, OUTSIDER_FIELDS);
    await controller.outsiders.insertOne(document as Outsider);
    SendServerRequestToSessionServer(MessageTypes.OUTSIDERS_UPDATE, {
        outsiders: { [outsider.id]: outsider },
    });
    return outsider;
}

async function deleteDbOutsider(
    outsiderId: Outsider["id"],
    controller: DatabaseController = databaseController,
) {
    const data = await controller.outsiders.deleteOne({
        id: outsiderId,
    });
    if (data.deletedCount === 0) {
        throw new ClientApiError(`No outsider by id ${outsiderId} found!`);
    }
    SendServerRequestToSessionServer(MessageTypes.OUTSIDERS_UPDATE, {
        outsiders: { [outsiderId]: null },
    });
}

export namespace DbOutsiders {
    export const get = getDbOutsiders;
    export const set = setDbOutsider;
    export const create = createDbOutsider;
    export const del = deleteDbOutsider;
}
