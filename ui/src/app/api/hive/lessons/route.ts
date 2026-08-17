export const dynamic = "force-dynamic";

import { ApiSuccess, ServerApi, withApi } from "@/api-server/common";
import { createHiveClient } from "@/api-server/hive/session-client";
import {
    ApiHiveLessonsGetPayload,
    ApiHiveLessonsGetResponse,
} from "@/api-shared/types/hive";

type ServerApiHiveLessonsGet = ServerApi<
    ApiHiveLessonsGetPayload,
    ApiHiveLessonsGetResponse
>;

export const GET: ServerApiHiveLessonsGet = withApi(async (request) => {
    const { searchParams } = new URL(request.url);
    const params: Record<string, any> = {};
    for (const [key, value] of searchParams.entries()) {
        params[key] = value;
    }

    const hiveClient = await createHiveClient();
    const data = await hiveClient.getLessons(params);

    return ApiSuccess(data);
});
