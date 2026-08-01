import { NextResponse } from "next/server";

import { getHealthReport } from "@/api-server/health";

// Unauthenticated by design (container healthcheck, load balancer probe), so
// the body carries only up/down/degraded per dependency — no versions, no
// hostnames, no error text.
export const dynamic = "force-dynamic";

export async function GET() {
    const report = await getHealthReport();

    // "degraded" (Hive down) still answers 200: the load balancer must keep
    // routing traffic, since Bluz itself is serving.
    return NextResponse.json(report, {
        status: report.status === "unhealthy" ? 503 : 200,
        headers: { "Cache-Control": "no-store" },
    });
}
