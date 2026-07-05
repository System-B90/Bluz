import { getMetaController } from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { ClientApiError } from "@/api-shared/errors";
import { CustomColor } from "@/api-shared/types/custom-color";
import { MessageTypes } from "@/settings";

async function getDbCustomColors(): Promise<Array<CustomColor>> {
    const cursor = getMetaController().customColors.find({});
    return await cursor.toArray();
}

async function setDbCustomColor(customColor: CustomColor) {
    const { _id: _, id: colorId, ...colorData } = customColor as any;
    const data = await getMetaController().customColors.updateOne(
        { id: colorId },
        { $set: colorData },
    );
    if (data.matchedCount === 0) {
        throw new ClientApiError(`No custom color by id ${colorId} found!`);
    }
    SendServerRequestToSessionServer(MessageTypes.CUSTOM_COLORS_UPDATE as any, {});
}

async function createDbCustomColor(customColor: CustomColor) {
    await getMetaController().customColors.insertOne(customColor);
    SendServerRequestToSessionServer(MessageTypes.CUSTOM_COLORS_UPDATE as any, {});
    return customColor;
}

async function deleteDbCustomColor(colorId: string) {
    const data = await getMetaController().customColors.deleteOne({ id: colorId });
    if (data.deletedCount === 0) {
        throw new ClientApiError(`No custom color by id ${colorId} found!`);
    }
    SendServerRequestToSessionServer(MessageTypes.CUSTOM_COLORS_UPDATE as any, {});
}

export namespace DbCustomColors {
    export const get = getDbCustomColors;
    export const set = setDbCustomColor;
    export const create = createDbCustomColor;
    export const del = deleteDbCustomColor;
}
