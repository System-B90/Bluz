export const dynamic = "force-dynamic";

import { ApiSuccess, ServerApi, withApi } from "@/api-server/common";
import { DbCustomColors } from "@/api-server/db-custom-colors";
import { ClientApiError } from "@/api-shared/errors";
import {
    ApiCustomColorCreatePayload,
    ApiCustomColorCreateResponse,
    ApiCustomColorDeletePayload,
    ApiCustomColorDeleteResponse,
    ApiCustomColorsGetPayload,
    ApiCustomColorsGetResponse,
    ApiCustomColorUpdatePayload,
    ApiCustomColorUpdateResponse,
} from "@/api-shared/types/custom-color";

type ServerApiCustomColorsGet = ServerApi<
    ApiCustomColorsGetPayload,
    ApiCustomColorsGetResponse
>;
type ServerApiCustomColorUpdate = ServerApi<
    ApiCustomColorUpdatePayload,
    ApiCustomColorUpdateResponse
>;
type ServerApiCustomColorCreate = ServerApi<
    ApiCustomColorCreatePayload,
    ApiCustomColorCreateResponse
>;
type ServerApiCustomColorDelete = ServerApi<
    ApiCustomColorDeletePayload,
    ApiCustomColorDeleteResponse
>;

export const GET: ServerApiCustomColorsGet = withApi(async (_request) => {
    const colors = await DbCustomColors.get();
    return ApiSuccess(colors);
});

export const POST: ServerApiCustomColorUpdate = withApi(async (request) => {
    const textBody = await request.text();
    const color = textBody ? JSON.parse(textBody) : null;
    if (!color) {
        throw new ClientApiError("No data provided!");
    }
    await DbCustomColors.set(color);
    return ApiSuccess(color);
});

export const PUT: ServerApiCustomColorCreate = withApi(async (request) => {
    const textBody = await request.text();
    const color = textBody ? JSON.parse(textBody) : null;
    if (!color) {
        throw new ClientApiError("No data provided!");
    }
    if (!color.id) {
        throw new ClientApiError("Color ID is not provided!");
    }
    const createdColor = await DbCustomColors.create(color);
    return ApiSuccess(createdColor);
});

export const DELETE: ServerApiCustomColorDelete = withApi(async (request) => {
    const textBody = await request.text();
    const colorId = textBody ? JSON.parse(textBody) : null;
    if (!colorId) {
        throw new ClientApiError("No colorId provided!");
    }
    await DbCustomColors.del(colorId);
    return ApiSuccess();
});
