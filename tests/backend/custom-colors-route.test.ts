import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/api-server/db-custom-colors", () => ({
    DbCustomColors: {
        get: vi.fn(),
        create: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
    },
}));

import * as CustomColorsRoute from "@/app/api/custom-colors/route";
import { DbCustomColors } from "@/api-server/db-custom-colors";

beforeEach(() => {
    vi.clearAllMocks();
});

function makeRequest(method: string, body?: unknown) {
    return new NextRequest("http://localhost/api/custom-colors", {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

describe("GET /api/custom-colors", () => {
    it("returns the colors from DbCustomColors.get", async () => {
        const colors = [ { id: "c1", name: "Red", hex: "#ff0000" } ];
        vi.mocked(DbCustomColors.get).mockResolvedValueOnce(colors as any);

        const response = await CustomColorsRoute.GET(makeRequest("GET"));
        expect(response.status).toBe(200);

        const json = await response.json();
        expect(json.data).toEqual(colors);
    });
});

describe("PUT /api/custom-colors (create)", () => {
    it("creates the color when an id is provided", async () => {
        const color = { id: "c1", name: "Red", hex: "#ff0000" };
        vi.mocked(DbCustomColors.create).mockResolvedValueOnce(color as any);

        const response = await CustomColorsRoute.PUT(makeRequest("PUT", color));
        expect(response.status).toBe(200);
        expect(DbCustomColors.create).toHaveBeenCalledWith(color);
    });

    it("returns 400 when no body is provided", async () => {
        const response = await CustomColorsRoute.PUT(makeRequest("PUT"));
        expect(response.status).toBe(400);
        expect(DbCustomColors.create).not.toHaveBeenCalled();
    });

    it("returns 400 when the color has no id", async () => {
        const response = await CustomColorsRoute.PUT(
            makeRequest("PUT", { name: "Red", hex: "#ff0000" }),
        );
        expect(response.status).toBe(400);
        expect(DbCustomColors.create).not.toHaveBeenCalled();
    });
});

describe("POST /api/custom-colors (update)", () => {
    it("updates the color", async () => {
        const color = { id: "c1", name: "Red Updated", hex: "#ee0000" };
        vi.mocked(DbCustomColors.set).mockResolvedValueOnce(undefined as any);

        const response = await CustomColorsRoute.POST(makeRequest("POST", color));
        expect(response.status).toBe(200);
        expect(DbCustomColors.set).toHaveBeenCalledWith(color);
    });

    it("returns 400 when no body is provided", async () => {
        const response = await CustomColorsRoute.POST(makeRequest("POST"));
        expect(response.status).toBe(400);
        expect(DbCustomColors.set).not.toHaveBeenCalled();
    });
});

describe("DELETE /api/custom-colors", () => {
    it("deletes the color by id", async () => {
        vi.mocked(DbCustomColors.del).mockResolvedValueOnce(undefined as any);

        const response = await CustomColorsRoute.DELETE(makeRequest("DELETE", "c1"));
        expect(response.status).toBe(200);
        expect(DbCustomColors.del).toHaveBeenCalledWith("c1");
    });

    it("returns 400 when no colorId is provided", async () => {
        const response = await CustomColorsRoute.DELETE(makeRequest("DELETE"));
        expect(response.status).toBe(400);
        expect(DbCustomColors.del).not.toHaveBeenCalled();
    });
});
