import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import { getHiveBaseUrl } from "@/api-shared/common";
import { AuthSessionData } from "@/api-shared/types/sso";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    // 1. Await params to extract the requested user ID (slug)
    const { slug } = await params;

    // 2. Retrieve the session token directly from the request cookies
    const token = await getToken({ req: request });
    const extraData: Partial<AuthSessionData> | undefined = token?.data as any;

    // 3. Verify authentication (we still need the token to authorize the fetch)
    if (!token || !token.data || !extraData || !extraData.accessToken) {
        return new NextResponse("Unauthorized: Missing session or access token", {
            status: 401,
        });
    }

    const accessToken = extraData.accessToken;

    // 4. Use the requested slug for the target URL instead of the current user's ID
    const targetUrl = `${getHiveBaseUrl()}/api/core/management/users/${slug}/avatar/`;

    try {
        console.log(targetUrl, accessToken);
        // 5. Make the authenticated server-to-server request to Hive
        const hiveResponse = await fetch(targetUrl, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Cookie: `token=${accessToken}`,
            },
        });

        // 6. Handle non-200 responses from Hive (e.g., user has no avatar)
        if (!hiveResponse.ok) {
            return new NextResponse(
                `Failed to fetch avatar: ${hiveResponse.statusText}`,
                {
                    status: hiveResponse.status,
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
                // Cache the image in the browser for 1 hour to reduce load on the Django server
                "Cache-Control": "private, max-age=3600",
            },
        });
    } catch (error) {
        console.error(`[Avatar Proxy Error for user ${slug}]:`, error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
