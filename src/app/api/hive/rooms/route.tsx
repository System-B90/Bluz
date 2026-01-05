import { ApiSuccess, catchHandler } from "@/api-server/common";
import { Class, ClassTypeEnum } from "@/api-server/hive/types";
import { NextRequest } from "next/server";

export async function GET(
    request: NextRequest,
)
{
    try
    {
        const rooms: Class[] = [
            {
                id: 1,
                name: "לאגונה",
                display_name: "לאגונה",
                program: 1,
                program__name: "אפולו",
                type: ClassTypeEnum.Room,
                users: [],
            },
            {
                id: 2,
                name: "נוקאוט",
                display_name: "נוקאוט",
                program: 2,
                program__name: "מבצר",
                type: ClassTypeEnum.Room,
                users: [],
            },
        ];

        return ApiSuccess(rooms);
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
