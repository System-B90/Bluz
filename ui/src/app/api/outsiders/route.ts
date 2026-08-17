export const dynamic = "force-dynamic";

import { ApiSuccess, ServerApi, withApi } from "@/api-server/common";
import { DbOutsiders } from "@/api-server/db-outsiders";
import {
    resolveIterationFromRequest,
    resolveWritableIterationFromRequest,
} from "@/api-server/iteration-request";
import { ClientApiError } from "@/api-shared/errors";
import {
    ApiOutsiderCreatePayload,
    ApiOutsiderCreateResponse,
    ApiOutsiderDeletePayload,
    ApiOutsiderDeleteResponse,
    ApiOutsidersGetPayload,
    ApiOutsidersGetResponse,
    ApiOutsiderUpdatePayload,
    ApiOutsiderUpdateResponse,
} from "@/api-shared/types/outsider";

type ServerApiOutsidersGet = ServerApi<
    ApiOutsidersGetPayload,
    ApiOutsidersGetResponse
>;
type ServerApiOutsiderUpdate = ServerApi<
    ApiOutsiderUpdatePayload,
    ApiOutsiderUpdateResponse
>;
type ServerApiOutsiderCreate = ServerApi<
    ApiOutsiderCreatePayload,
    ApiOutsiderCreateResponse
>;
type ServerApiOutsiderDelete = ServerApi<
    ApiOutsiderDeletePayload,
    ApiOutsiderDeleteResponse
>;

export const GET: ServerApiOutsidersGet = withApi(async (request) => {
    const { controller } = await resolveIterationFromRequest(request);
    const outsiders = await DbOutsiders.get(undefined, controller);
    return ApiSuccess(outsiders);
});

export const POST: ServerApiOutsiderUpdate = withApi(async (request) => {
    const { controller } =
        await resolveWritableIterationFromRequest(request);
    const outsider = await request.json();
    if (!outsider) {
        throw new ClientApiError("No data provided!");
    }
    await DbOutsiders.set(outsider, undefined, controller);
    return ApiSuccess(outsider);
});

export const PUT: ServerApiOutsiderCreate = withApi(async (request) => {
    const { controller } =
        await resolveWritableIterationFromRequest(request);
    const outsider = await request.json();
    if (!outsider) {
        throw new ClientApiError("No data provided!");
    }
    if (!outsider.id) {
        throw new ClientApiError("Outsider ID is not provided!");
    }
    const createdOutsider = await DbOutsiders.create(outsider, controller);
    return ApiSuccess(createdOutsider);
});

export const DELETE: ServerApiOutsiderDelete = withApi(async (request) => {
    const { controller } =
        await resolveWritableIterationFromRequest(request);
    const outsiderId = await request.json();
    if (!outsiderId) {
        throw new ClientApiError("No outsiderId provided!");
    }
    await DbOutsiders.del(outsiderId, controller);
    return ApiSuccess();
});
