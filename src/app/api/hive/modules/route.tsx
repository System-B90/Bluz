import { ApiSuccess, catchHandler } from "@/api-server/common";
import { getHiveClient } from "@/api-server/hive/client";
import { Module } from "@/components/schedule/types/module";
import { NextRequest } from "next/server";

export async function GET(
    request: NextRequest,
)
{
    try
    {
        const hiveClient = await getHiveClient();
        const modules: Module[] = await hiveClient.getModules();
        return ApiSuccess(modules);
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
