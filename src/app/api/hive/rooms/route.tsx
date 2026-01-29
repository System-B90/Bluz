import { ApiSuccess, catchHandler } from "@/api-server/common";
import { getHiveClient } from "@/api-server/hive/client";
import { Class, ClassTypeEnum } from "@/api-server/hive/types";
import { NextRequest } from "next/server";

export async function GET(
    request: NextRequest,
)
{
    try
    {
        const hiveClient = await getHiveClient();
        const rooms: Class[] = (await hiveClient.getClasses()).filter(c => c.type === ClassTypeEnum.Room);
        return ApiSuccess(rooms);
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
