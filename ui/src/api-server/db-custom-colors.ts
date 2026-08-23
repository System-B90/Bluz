import { pickFields } from "@/api-server/common";
import { getMetaController } from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { ClientApiError } from "@/api-shared/errors";
import { CustomColor } from "@/api-shared/types/custom-color";
import { MessageTypes } from "@/settings";

// Client payloads are copied field-by-field, so the document shape is an
// explicit allow-list rather than whatever the caller sent (#538 item 4).
const CUSTOM_COLOR_FIELDS = ["id", "name", "hex"] as const;
// `id` is the match key, never part of the update.
const CUSTOM_COLOR_UPDATE_FIELDS = ["name", "hex"] as const;

async function getDbCustomColors(): Promise<Array<CustomColor>> {
    const cursor = getMetaController().customColors.find({});
    return await cursor.toArray();
}

async function setDbCustomColor(customColor: CustomColor) {
    const { id: colorId } = customColor;
    const data = await getMetaController().customColors.updateOne(
        { id: colorId },
        { $set: pickFields(customColor, CUSTOM_COLOR_UPDATE_FIELDS) },
    );
    if (data.matchedCount === 0) {
        throw new ClientApiError(`No custom color by id ${colorId} found!`);
    }
    SendServerRequestToSessionServer(MessageTypes.CUSTOM_COLORS_UPDATE, {});
}

async function createDbCustomColor(customColor: CustomColor) {
    await getMetaController().customColors.insertOne(
        pickFields(customColor, CUSTOM_COLOR_FIELDS),
    );
    SendServerRequestToSessionServer(MessageTypes.CUSTOM_COLORS_UPDATE, {});
    return customColor;
}

async function deleteDbCustomColor(colorId: string) {
    const data = await getMetaController().customColors.deleteOne({ id: colorId });
    if (data.deletedCount === 0) {
        throw new ClientApiError(`No custom color by id ${colorId} found!`);
    }
    SendServerRequestToSessionServer(MessageTypes.CUSTOM_COLORS_UPDATE, {});
}

export namespace DbCustomColors {
    export const get = getDbCustomColors;
    export const set = setDbCustomColor;
    export const create = createDbCustomColor;
    export const del = deleteDbCustomColor;
}
