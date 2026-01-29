import { ApiSuccess, catchHandler } from "@/api-server/common";
import { getHiveClient } from "@/api-server/hive/client";
import { Subject } from "@/components/schedule/types/subject";
import { NextRequest } from "next/server";

export async function GET(
    request: NextRequest,
)
{
    try
    {
        const hiveClient = await getHiveClient();
        const subjects: Subject[] = await hiveClient.getSubjects();
        return ApiSuccess(subjects);
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
