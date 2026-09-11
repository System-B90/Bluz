import { NextResponse } from "next/server";

import { requireStudentViewSession } from "@/api-server/student-view";
import { signWsTicket, WsScope } from "@/settings";

/**
 * Issues a session-server WebSocket ticket, scoped to the caller's clearance
 * (#656).
 *
 * The scope is signed, so the browser cannot upgrade itself, and it is what
 * the session server gates on: a `hanich` socket may not register a session
 * (which would put it on the untargeted broadcast, where course/outsider/room
 * payloads travel) and may listen only to the student refresh channel, which
 * carries nothing but empty pings.
 */
export async function GET() {
    try {
        const { isStaff, userId } = await requireStudentViewSession();
        return NextResponse.json({
            ticket: signWsTicket(
                userId,
                isStaff ? WsScope.Segel : WsScope.Hanich,
            ),
        });
    } catch {
        return new NextResponse("Unauthorized", { status: 401 });
    }
}
