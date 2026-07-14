import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth/jwt", () => ({
    getToken: vi.fn(async () => ({
        data: { accessToken: "token-abc" },
    })),
}));

vi.mock("@/api-shared/common", () => ({
    getHiveBaseUrl: () => "https://hive.example.com",
}));

import { GET } from "@/app/api/hive/users/avatars/[slug]/route";

describe("GET /api/hive/users/avatars/[slug]", () => {
    it("rejects a slug containing a path separator (SSRF via redirected target URL)", async () => {
        const request = new NextRequest(
            "https://bluz.example.com/api/hive/users/avatars/123/../../evil",
        );
        const response = await GET(request, {
            params: Promise.resolve({ slug: "../evil" }),
        });
        expect(response.status).toBe(400);
    });

    it("rejects a slug that embeds a full URL", async () => {
        const request = new NextRequest(
            "https://bluz.example.com/api/hive/users/avatars/x",
        );
        const response = await GET(request, {
            params: Promise.resolve({
                slug: "http://attacker.example.com",
            }),
        });
        expect(response.status).toBe(400);
    });

    it("accepts a plain alphanumeric user id", async () => {
        global.fetch = vi.fn(async () => ({
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(0),
            headers: new Headers({ "Content-Type": "image/png" }),
        })) as any;

        const request = new NextRequest(
            "https://bluz.example.com/api/hive/users/avatars/user_42",
        );
        const response = await GET(request, {
            params: Promise.resolve({ slug: "user_42" }),
        });
        expect(response.status).toBe(200);
    });
});
