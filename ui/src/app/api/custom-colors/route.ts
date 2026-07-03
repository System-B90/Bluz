export const dynamic = "force-dynamic";

import { ApiSuccess, catchHandler, ServerApi } from "@/api-server/common";
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

export const GET: ServerApiCustomColorsGet = async (request) => {
    try {
        const colors = await DbCustomColors.get();
        return ApiSuccess(colors);
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const POST: ServerApiCustomColorUpdate = async (request) => {
    try {
        const color = await request.json();
        if (!color) {
            throw new ClientApiError("No data provided!");
        }
        await DbCustomColors.set(color);
        return ApiSuccess(color);
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const PUT: ServerApiCustomColorCreate = async (request) => {
    try {
        const color = await request.json();
        if (!color) {
            throw new ClientApiError("No data provided!");
        }
        if (!color.id) {
            throw new ClientApiError("Color ID is not provided!");
        }
        const createdColor = await DbCustomColors.create(color);
        return ApiSuccess(createdColor);
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const DELETE: ServerApiCustomColorDelete = async (request) => {
    try {
        const colorId = await request.json();
        if (!colorId) {
            throw new ClientApiError("No colorId provided!");
        }
        await DbCustomColors.del(colorId);
        return ApiSuccess();
    } catch (e) {
        return catchHandler(request, e);
    }
};
