import { NextResponse } from "next/server";
import NextAuth from "next-auth";

import { authOptions } from "@/api-server/hive/sso";

const handler = NextAuth(authOptions);

const customHandler = async (req: Request, context: any) => {
    try {
        return await handler(req, context);
    } catch (error) {
        console.error("NextAuth Handler Error:", error);

        // Only a top-level browser navigation can act on an HTML redirect.
        // Everything else here is a programmatic caller (the session probe,
        // /api/auth/providers, the CLI), and redirecting those to
        // /login?error=... turned a real failure into an opaque HTML body
        // (#539 item 8). Sec-Fetch-Mode tells the two apart; treat a missing
        // header as programmatic, since every browser navigation sends it.
        const isNavigation = req.headers.get("sec-fetch-mode") === "navigate";
        if (!isNavigation) {
            return NextResponse.json(
                { error: "Authentication service unavailable." },
                { status: 503 },
            );
        }

        // For browser navigation (like callback), redirect to login with error
        return NextResponse.redirect(
            new URL("/login?error=AuthenticationFailed", req.url),
        );
    }
};

export { customHandler as GET, customHandler as POST };
