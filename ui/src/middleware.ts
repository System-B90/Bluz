import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_API_PREFIXES = ["/api/gantt/", "/api/hive/"];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const isProtectedApi = PROTECTED_API_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix),
    );
    if (!isProtectedApi) return NextResponse.next();

    const token = await getToken({ req: request });
    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/api/gantt/:path*", "/api/hive/:path*"],
};
