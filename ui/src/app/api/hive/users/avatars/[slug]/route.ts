import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import { getHiveBaseUrl } from "@/api-shared/common";
import { AuthSessionData } from "@/api-shared/types/sso";

/** Client cache lifetime for an avatar Hive actually served. */
const FOUND_MAX_AGE_SECONDS = 3 * 24 * 60 * 60;
/**
 * Client cache lifetime for a miss. Shorter than a hit so an instructor who
 * uploads an avatar starts showing it within a day, while still sparing Hive
 * a request per render for the many users who never upload one.
 */
const NOT_FOUND_MAX_AGE_SECONDS = 24 * 60 * 60;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    // 1. Await params to extract the requested user ID (slug)
    const { slug } = await params;

    // Reject anything that isn't a plain Hive user id/username segment —
    // slug is interpolated directly into the upstream URL, so path
    // separators or a full URL here would let a caller redirect the
    // server-side fetch (SSRF) instead of hitting the avatar endpoint.
    if (!/^[\w-]+$/.test(slug)) {
        return new NextResponse("Invalid user identifier", { status: 400 });
    }

    // 2. Retrieve the session token directly from the request cookies
    const token = await getToken({ req: request });
    const extraData: Partial<AuthSessionData> | undefined = token?.data as any;

    // 3. Verify authentication (we still need the token to authorize the fetch)
    if (!token || !token.data || !extraData || !extraData.accessToken) {
        return new NextResponse(
            "Unauthorized: Missing session or access token",
            {
                status: 401,
            },
        );
    }

    const accessToken = extraData.accessToken;

    // 4. Use the requested slug for the target URL instead of the current user's ID
    const targetUrl = `${getHiveBaseUrl()}/api/core/management/users/${slug}/avatar/`;

    try {
        // 5. Make the authenticated server-to-server request to Hive
        const hiveResponse = await fetch(targetUrl, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Cookie: `token=${accessToken}`,
            },
        });

        // 6. Handle non-200 responses from Hive (e.g., user has no avatar).
        //    A miss is cached too — most users never upload an avatar, and
        //    without this every list re-asks Hive for each of them.
        if (!hiveResponse.ok) {
            return new NextResponse(
                `Failed to fetch avatar: ${hiveResponse.statusText}`,
                {
                    status: hiveResponse.status,
                    headers: {
                        "Cache-Control": `private, max-age=${NOT_FOUND_MAX_AGE_SECONDS}`,
                    },
                },
            );
        }

        // 7. Extract the raw binary image data
        const imageBuffer = await hiveResponse.arrayBuffer();

        // 8. Pipe the image directly to the Baluz frontend with the correct headers
        return new NextResponse(imageBuffer, {
            status: 200,
            headers: {
                // Pass along the exact image type (image/jpeg, image/png, etc.) provided by Hive
                "Content-Type":
                    hiveResponse.headers.get("Content-Type") ??
                    "application/octet-stream",
                // Private: the response is gated on the caller's session, so
                // only the browser may cache it — never a shared proxy.
                "Cache-Control": `private, max-age=${FOUND_MAX_AGE_SECONDS}`,
            },
        });
    } catch (error) {
        console.error(`[Avatar Proxy Error for user ${slug}]:`, error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
