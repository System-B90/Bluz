export const dynamic = "force-dynamic";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { getHiveClient } from "@/api-server/hive/client";
import { NextRequest } from "next/server";

export async function GET(
    request: NextRequest
)
{
    try
    {
        const username = process.env.HIVE_USERNAME;
        const password = process.env.HIVE_PASSWORD;

        if (!username || !password)
        {
            throw new Error("HIVE_USERNAME and HIVE_PASSWORD must be defined in environment variables.");
        }

        const hiveClient = await getHiveClient(username, password);
        const data = await hiveClient.getClasses();

        return ApiSuccess(data);
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
