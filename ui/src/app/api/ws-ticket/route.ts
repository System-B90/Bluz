import { NextResponse } from "next/server";

import { getSessionUser } from "@/api-server/session-user";
import { signWsTicket } from "@/settings";

export async function GET() {
    const user = await getSessionUser();
    if (!user) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    return NextResponse.json({ ticket: signWsTicket(user.id) });
}
