export const dynamic = "force-dynamic";

import { createHash, timingSafeEqual } from "node:crypto";

import { withApi } from "@/api-server/common";
import { loadHiveScheduleFeed } from "@/api-server/hive/schedule-feed";

// Hash both sides first: timingSafeEqual needs equal lengths, and comparing
// digests leaks nothing about the secret's length.
function tokenMatches(presented: string, expected: string): boolean {
    const digest = (value: string) =>
        createHash("sha256").update(value).digest();
    return timingSafeEqual(digest(presented), digest(expected));
}

function presentedToken(request: Request): string {
    const header = request.headers.get("authorization") ?? "";
    if (header.toLowerCase().startsWith("bearer "))
        return header.slice(7).trim();
    // Calendar clients that cannot set headers subscribe with ?token=.
    return new URL(request.url).searchParams.get("token") ?? "";
}

/**
 * GET /api/event/export/hive — the current schedule as an ICS feed in the
 * shape Hive's external schedule mode loads (see `api-server/hive/schedule-feed`).
 *
 * Machine-to-machine: no SSO session, a shared bearer token
 * (`HIVE_SCHEDULE_FEED_TOKEN`) instead. Unset token = feature off = 404.
 * Answers `If-None-Match` with 304, so a poller costs one hash per unchanged tick.
 */
export const GET = withApi(async (request: Request) => {
    const expected = process.env.HIVE_SCHEDULE_FEED_TOKEN;
    if (!expected) return new Response(null, { status: 404 });
    if (!tokenMatches(presentedToken(request), expected)) {
        return new Response(null, { status: 401 });
    }

    const feed = await loadHiveScheduleFeed();
    if (!feed) return new Response(null, { status: 503 });

    const headers = new Headers({
        "Cache-Control": "no-cache",
        ETag: feed.etag,
    });
    if (request.headers.get("if-none-match") === feed.etag) {
        return new Response(null, { headers, status: 304 });
    }

    headers.set("Content-Type", "text/calendar; charset=utf-8");
    return new Response(feed.body, { headers, status: 200 });
});
