import { ApiSuccess, catchHandler, ServerApi } from "@/api-server/common";
import { createHiveClient } from "@/api-server/hive/session-client";
import {
    ApiHiveClassesGetPayload,
    ApiHiveClassesGetResponse,
} from "@/api-shared/types/hive";

type ServerApiHiveClassesGet = ServerApi<
  ApiHiveClassesGetPayload,
  ApiHiveClassesGetResponse
>;

export const GET: ServerApiHiveClassesGet = async (request) => {
    try {
        const hiveClient = await createHiveClient();
        const data = await hiveClient.getClasses();

        return ApiSuccess(data);
    } catch (e) {
        return catchHandler(request, e);
    }
};
