import { ApiSuccess, catchHandler, ServerApi } from "@/api-server/common";
import { getHiveStudents } from "@/api-server/hive/students";
import {
    ApiHiveStudentsGetPayload,
    ApiHiveStudentsGetResponse,
} from "@/api-shared/types/hive";

type ServerApiHiveStudentsGet = ServerApi<
  ApiHiveStudentsGetPayload,
  ApiHiveStudentsGetResponse
>;

export const GET: ServerApiHiveStudentsGet = async (request) => {
    try {
        const data = await getHiveStudents();
        return ApiSuccess(data);
    } catch (e) {
        return catchHandler(request, e);
    }
};
