import NextAuth from "next-auth";

import { authOptions } from "@/api-server/hive/sso";

import { NextResponse } from "next/server";

const handler = NextAuth(authOptions);

const customHandler = async (req: Request, context: any) => {
    try {
        return await handler(req, context);
    } catch (error) {
        console.error("NextAuth Handler Error:", error);
        
        const url = new URL(req.url);
        if (url.pathname.includes("/api/auth/session") || url.pathname.includes("/api/auth/_log")) {
            return NextResponse.json(
                { error: "Authentication service unavailable." },
                { status: 503 }
            );
        }

        // For browser navigation (like callback), redirect to login with error
        return NextResponse.redirect(new URL("/login?error=AuthenticationFailed", req.url));
    }
};

export { customHandler as GET, customHandler as POST };
