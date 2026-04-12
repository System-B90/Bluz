import { ApiSuccess, catchHandler } from "@/api-server/common";
import { getAllRooms } from "@/app/api/rooms/utils";
import { NextRequest } from "next/server";

export async function GET(
    request: NextRequest,
)
{
    try
    {
        const rooms = await getAllRooms();
        return ApiSuccess(rooms);
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
