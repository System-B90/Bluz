import { NextResponse } from "next/server";

import { isHiveReachable } from "@/api-server/hive/health";

export async function GET() {
    const reachable = await isHiveReachable();
    return NextResponse.json({ reachable });
}
