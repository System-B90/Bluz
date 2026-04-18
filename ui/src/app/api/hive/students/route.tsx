export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { getHiveStudents } from "@/api-server/hive/students";

export async function GET(
    request: NextRequest
)
{
    try
    {
        const data = await getHiveStudents();
        return ApiSuccess(data);
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
