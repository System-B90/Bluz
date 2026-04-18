import { NextRequest } from "next/server";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { createHiveClient } from "@/api-server/hive/session-client";
import { HiveRoom } from "@/components/schedule/types/room";

export async function GET(
    request: NextRequest,
)
{
    try
    {
        const hiveClient = await createHiveClient();
        const rooms: Array<HiveRoom> = (await hiveClient.getRooms());
        return ApiSuccess(rooms);
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
