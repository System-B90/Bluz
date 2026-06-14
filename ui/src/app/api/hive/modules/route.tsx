import { ApiSuccess, catchHandler, ServerApi } from "@/api-server/common";
import { createHiveClient } from "@/api-server/hive/session-client";
import {
    ApiHiveModulesGetPayload,
    ApiHiveModulesGetResponse,
} from "@/api-shared/types/module";

type ServerApiHiveModulesGet = ServerApi<
  ApiHiveModulesGetPayload,
  ApiHiveModulesGetResponse
>;

export const GET: ServerApiHiveModulesGet = async (request) => {
    try {
        const hiveClient = await createHiveClient();
        const modules = await hiveClient.getModules();
        return ApiSuccess(modules);
    } catch (e) {
        return catchHandler(request, e);
    }
};
