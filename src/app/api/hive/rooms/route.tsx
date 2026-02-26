import { ApiSuccess, catchHandler } from "@/api-server/common";
import { getHiveClient } from "@/api-server/hive/client";
import { Class, ClassTypeEnum } from "@/api-server/hive/types";
import { HiveRoom } from "@/components/schedule/types/room";
import { NextRequest } from "next/server";

export async function GET(
    request: NextRequest,
)
{
    try
    {
        const hiveClient = await getHiveClient();
        const rooms: Array<HiveRoom> = (await hiveClient.getRooms());
        return ApiSuccess(rooms);
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
