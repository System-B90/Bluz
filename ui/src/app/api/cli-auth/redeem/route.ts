import { NextRequest } from "next/server";

import {
    allowHandoffRedeemAttempt,
    rateLimitKeyForRequest,
} from "@/api-server/cli-handoff-rate-limit";
import { ApiSuccess, requireJsonObjectBody, withApi } from "@/api-server/common";
import { DbCliHandoff } from "@/api-server/db-cli-handoff";
import { ClientApiError } from "@/api-shared/errors";

export const dynamic = "force-dynamic";

type RedeemPayload = { code?: unknown };
type RedeemResponse = { token: string };

/**
 * Redeems a CLI login handoff code (#520) for the next-auth session token it
 * was minted for. Deliberately unauthenticated -- the caller (the CLI, not a
 * browser) has no session yet; the handoff code itself is the credential,
 * single-use and short-TTL (see db-cli-handoff.ts).
 */
export const POST = withApi(async (request: NextRequest) => {
    if (!allowHandoffRedeemAttempt(rateLimitKeyForRequest(request))) {
        throw new ClientApiError("Too many attempts. Try again shortly.");
    }

    const { code } = await requireJsonObjectBody<RedeemPayload>(request);
    if (typeof code !== "string" || !code) {
        throw new ClientApiError("Missing or invalid code.");
    }

    const token = await DbCliHandoff.redeem(code);
    return ApiSuccess<RedeemResponse>({ token });
});
