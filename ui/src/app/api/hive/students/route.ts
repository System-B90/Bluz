import { ApiSuccess, ServerApi, withApi } from "@/api-server/common";
import { getHiveStudents } from "@/api-server/hive/students";
import {
    ApiHiveStudentsGetPayload,
    ApiHiveStudentsGetResponse,
} from "@/api-shared/types/hive";

type ServerApiHiveStudentsGet = ServerApi<
    ApiHiveStudentsGetPayload,
    ApiHiveStudentsGetResponse
>;

export const GET: ServerApiHiveStudentsGet = withApi(async (_request) => {
    const data = await getHiveStudents();
    return ApiSuccess(data);
});
