import { NextRequest } from "next/server";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { createHiveClient } from "@/api-server/hive/session-client";
import { Module } from "@/components/schedule/types/module";

export async function GET(request: NextRequest) {
  try {
    const hiveClient = await createHiveClient();
    const modules: Module[] = await hiveClient.getModules();
    return ApiSuccess(modules);
  } catch (e) {
    return catchHandler(request, e);
  }
}
