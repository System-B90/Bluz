import { NextRequest } from "next/server";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { createHiveClient } from "@/api-server/hive/session-client";
import { Subject } from "@/api-shared/types/subject";

export async function GET(request: NextRequest) {
    try {
        const hiveClient = await createHiveClient();
        const subjects: Array<Subject> = await hiveClient.getSubjects();
        return ApiSuccess(subjects);
    } catch (e) {
        return catchHandler(request, e);
    }
}
