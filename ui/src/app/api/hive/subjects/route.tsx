import { ApiSuccess, catchHandler } from "@/api-server/common";
import createHiveClient from "@/api-server/hive/session-client";
import { Subject } from "@/components/schedule/types/subject";
import { NextRequest } from "next/server";

export async function GET(
    request: NextRequest,
)
{
    try
    {
        const hiveClient = await createHiveClient();
        const subjects: Subject[] = await hiveClient.getSubjects();
        return ApiSuccess(subjects);
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
