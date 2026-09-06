import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/api-server/db-personal-settings", () => ({
    DbPersonalSettings: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

// Staff-gated since #656: a Hanich session can hold a session but must not
// reach this route, so the gate is `requireStaffSession`, which throws.
vi.mock("@/api-server/session-user", () => ({
    requireStaffSession: vi.fn(),
}));

import { DbPersonalSettings } from "@/api-server/db-personal-settings";
import { requireStaffSession } from "@/api-server/session-user";
import { ForbiddenError } from "@/api-shared/errors";
import * as PersonalSettingsRoute from "@/app/api/personal-settings/route";

beforeEach(() => vi.clearAllMocks());

const user = { id: "u1", displayName: "מיכאל" };
const settings = {
    groups: [ "g1" ],
    instructors: [],
    favoriteOutsiders: [],
};

describe("GET /api/personal-settings", () => {
    it("returns the current user's settings", async () => {
        vi.mocked(requireStaffSession).mockResolvedValueOnce(user as never);
        vi.mocked(DbPersonalSettings.get).mockResolvedValueOnce(settings);

        const req = new NextRequest("http://localhost/api/personal-settings");
        const res = await PersonalSettingsRoute.GET(req);
        const body = await res.json();

        expect(DbPersonalSettings.get).toHaveBeenCalledWith("u1");
        expect(res.status).toBe(200);
        expect(body.data).toEqual(settings);
    });

    it("fails when the caller is not staff", async () => {
        vi.mocked(requireStaffSession).mockRejectedValueOnce(
            new ForbiddenError("Forbidden: insufficient clearance."),
        );

        const req = new NextRequest("http://localhost/api/personal-settings");
        const res = await PersonalSettingsRoute.GET(req);

        expect(res.status).not.toBe(200);
        expect(DbPersonalSettings.get).not.toHaveBeenCalled();
    });
});

describe("POST /api/personal-settings", () => {
    it("saves settings for the current user", async () => {
        vi.mocked(requireStaffSession).mockResolvedValueOnce(user as never);
        vi.mocked(DbPersonalSettings.set).mockResolvedValueOnce(settings);

        const req = new NextRequest("http://localhost/api/personal-settings", {
            method: "POST",
            body: JSON.stringify(settings),
        });
        const res = await PersonalSettingsRoute.POST(req);
        const body = await res.json();

        expect(DbPersonalSettings.set).toHaveBeenCalledWith("u1", settings);
        expect(res.status).toBe(200);
        expect(body.data).toEqual(settings);
    });

    it("fails when the caller is not staff", async () => {
        vi.mocked(requireStaffSession).mockRejectedValueOnce(
            new ForbiddenError("Forbidden: insufficient clearance."),
        );

        const req = new NextRequest("http://localhost/api/personal-settings", {
            method: "POST",
            body: JSON.stringify(settings),
        });
        const res = await PersonalSettingsRoute.POST(req);

        expect(res.status).not.toBe(200);
        expect(DbPersonalSettings.set).not.toHaveBeenCalled();
    });
});
