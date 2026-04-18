export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { createHiveClient } from "@/api-server/hive/session-client";

export async function GET(request: NextRequest) {
    try {
        const hiveClient = await createHiveClient();
        return ApiSuccess(await hiveClient.getUsers());
    } catch (e) {
        return catchHandler(request, e);
    }
}
