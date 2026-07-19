export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { connectGoogleCalendar } from "@/api-server/google/google-calendar-service";
import { getSessionUser } from "@/api-server/session-user";

/** GET /api/integrations/google-calendar/callback — Google OAuth redirect target. */
export async function GET(request: NextRequest) {
    const origin = request.nextUrl.origin;
    const redirectTo = (status: "error" | "ok") =>
        NextResponse.redirect(`${origin}/?googleCalendar=${status}`);

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    if (!code || !state) return redirectTo("error");

    const user = await getSessionUser();
    // The OAuth `state` must match the still-signed-in user who started the
    // flow — prevents a stolen/replayed code from linking to another account.
    if (!user || user.id !== state) return redirectTo("error");

    try {
        await connectGoogleCalendar(user.id, code);
        return redirectTo("ok");
    } catch (error) {
        console.error("Google Calendar connect failed:", error);
        return redirectTo("error");
    }
}
