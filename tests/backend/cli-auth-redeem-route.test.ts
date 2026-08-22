import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/api-server/db-cli-handoff", () => ({
    DbCliHandoff: {
        create: vi.fn(),
        redeem: vi.fn(),
    },
}));
vi.mock("@/api-server/cli-handoff-rate-limit", () => ({
    allowHandoffRedeemAttempt: vi.fn(() => true),
    rateLimitKeyForRequest: vi.fn(() => "127.0.0.1"),
}));

import * as RedeemRoute from "@/app/api/cli-auth/redeem/route";
import { DbCliHandoff } from "@/api-server/db-cli-handoff";
import {
    allowHandoffRedeemAttempt,
    rateLimitKeyForRequest,
} from "@/api-server/cli-handoff-rate-limit";
import { ClientApiError } from "@/api-shared/errors";

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(allowHandoffRedeemAttempt).mockReturnValue(true);
    vi.mocked(rateLimitKeyForRequest).mockReturnValue("127.0.0.1");
});

function makeRequest(body?: unknown) {
    return new NextRequest("http://localhost/api/cli-auth/redeem", {
        method: "POST",
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

describe("POST /api/cli-auth/redeem", () => {
    it("redeems a valid code and returns the token", async () => {
        vi.mocked(DbCliHandoff.redeem).mockResolvedValueOnce("session-token-value");

        const response = await RedeemRoute.POST(makeRequest({ code: "abc123" }));
        expect(response.status).toBe(200);

        const json = await response.json();
        expect(json.data).toEqual({ token: "session-token-value" });
        expect(DbCliHandoff.redeem).toHaveBeenCalledWith("abc123");
    });

    it("rejects a body with no code", async () => {
        const response = await RedeemRoute.POST(makeRequest({}));
        expect(response.status).toBe(400);
        expect(DbCliHandoff.redeem).not.toHaveBeenCalled();
    });

    it("rejects a non-string code", async () => {
        const response = await RedeemRoute.POST(makeRequest({ code: 12345 }));
        expect(response.status).toBe(400);
        expect(DbCliHandoff.redeem).not.toHaveBeenCalled();
    });

    it("maps an unknown/already-used code to a 400, not a 500", async () => {
        vi.mocked(DbCliHandoff.redeem).mockRejectedValueOnce(
            new ClientApiError("Invalid or already-used code."),
        );

        const response = await RedeemRoute.POST(makeRequest({ code: "used-code" }));
        expect(response.status).toBe(400);
    });

    it("maps an expired code to a 400, not a 500", async () => {
        vi.mocked(DbCliHandoff.redeem).mockRejectedValueOnce(
            new ClientApiError("Code has expired."),
        );

        const response = await RedeemRoute.POST(makeRequest({ code: "old-code" }));
        expect(response.status).toBe(400);
    });

    it("a second redemption attempt of the same code fails once DbCliHandoff reports it consumed", async () => {
        vi.mocked(DbCliHandoff.redeem)
            .mockResolvedValueOnce("session-token-value")
            .mockRejectedValueOnce(new ClientApiError("Invalid or already-used code."));

        const first = await RedeemRoute.POST(makeRequest({ code: "abc123" }));
        expect(first.status).toBe(200);

        const second = await RedeemRoute.POST(makeRequest({ code: "abc123" }));
        expect(second.status).toBe(400);
    });

    it("rejects the request once the rate limit is exceeded, without calling redeem", async () => {
        vi.mocked(allowHandoffRedeemAttempt).mockReturnValueOnce(false);

        const response = await RedeemRoute.POST(makeRequest({ code: "abc123" }));
        expect(response.status).toBe(400);
        expect(DbCliHandoff.redeem).not.toHaveBeenCalled();
    });
});
