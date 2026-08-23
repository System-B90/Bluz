export const dynamic = "force-dynamic";

import {
    ApiSuccess,
    parseJsonBody,
    requireJsonObjectBody,
    ServerApi,
    withApi,
} from "@/api-server/common";
import { DbOutsiders } from "@/api-server/db-outsiders";
import {
    resolveIterationFromRequest,
    resolveWritableIterationFromRequest,
} from "@/api-server/iteration-request";
import { requireStaffSession } from "@/api-server/session-user";
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
    await requireStaffSession();
    const { controller } = await resolveIterationFromRequest(request);
    const outsiders = await DbOutsiders.get(undefined, controller);
    return ApiSuccess(outsiders);
});

export const POST: ServerApiOutsiderUpdate = withApi(async (request) => {
    await requireStaffSession();
    const { controller } = await resolveWritableIterationFromRequest(request);
    const outsider =
        await requireJsonObjectBody<ApiOutsiderUpdatePayload>(request);
    await DbOutsiders.set(outsider, undefined, controller);
    return ApiSuccess(outsider);
});

export const PUT: ServerApiOutsiderCreate = withApi(async (request) => {
    await requireStaffSession();
    const { controller } = await resolveWritableIterationFromRequest(request);
    const outsider =
        await requireJsonObjectBody<ApiOutsiderCreatePayload>(request);
    if (!outsider.id) {
        throw new ClientApiError("Outsider ID is not provided!");
    }
    const createdOutsider = await DbOutsiders.create(outsider, controller);
    return ApiSuccess(createdOutsider);
});

export const DELETE: ServerApiOutsiderDelete = withApi(async (request) => {
    await requireStaffSession();
    const { controller } = await resolveWritableIterationFromRequest(request);
    // The client sends a bare JSON string id here, not an object — parse with
    // the shared helper so a malformed payload is a 400, not a 500.
    const outsiderId = parseJsonBody<ApiOutsiderDeletePayload>(
        await request.text(),
    );
    if (!outsiderId) {
        throw new ClientApiError("No outsiderId provided!");
    }
    await DbOutsiders.del(outsiderId, controller);
    return ApiSuccess();
});
