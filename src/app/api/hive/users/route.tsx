export const dynamic = "force-dynamic";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { getHiveClient } from "@/api-server/hive/client";
import { NextRequest } from "next/server";

export async function GET(
    request: NextRequest,
)
{
    try
    {
        const hiveClient = await getHiveClient();
        return ApiSuccess(await hiveClient.getUsers());
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
