import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { Mock } from "vitest";

declare global {
    // eslint-disable-next-line no-var
    var mockNextAuthHandler: Mock<(...args: Array<unknown>) => unknown>;
}

// Mock next-auth and define the handler-returning factory during module resolution
vi.mock("next-auth", () => {
    const mockHandlerFn = vi.fn((...args: Array<unknown>) => {
        return globalThis.mockNextAuthHandler(...args);
    });
    globalThis.mockNextAuthHandler = vi.fn();
    return {
        default: vi.fn(() => mockHandlerFn),
        // Routes gate on requireStaffSession() (#510), which reads the session
        // through getServerSession; this file replaces the whole module, so it
        // has to supply it too.
        getServerSession: vi.fn(async () => ({
            user: { id: "test-user", clearance: 3, display_name: "Test Staff" },
        })),
    };
});

vi.mock("next-auth/jwt", () => ({
    getToken: vi.fn(),
}));

// Mock Hive Client
const mockHiveClient = {
    getClasses: vi.fn(),
    getModules: vi.fn(),
    getRooms: vi.fn(),
    getStudents: vi.fn(),
    getSubjects: vi.fn(),
    getUsers: vi.fn(),
};

vi.mock("@/api-server/hive/session-client", () => ({
    createHiveClient: vi.fn(async () => mockHiveClient),
}));

// Mock getHiveStudents directly
vi.mock("@/api-server/hive/students", () => ({
    getHiveStudents: vi.fn(),
}));

// Mock DbSettings & DbOutsiders & Prayer utils
vi.mock("@/api-server/db-settings", () => ({
    DbSettings: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

vi.mock("@/api-server/db-outsiders", () => ({
    DbOutsiders: {
        get: vi.fn(),
        set: vi.fn(),
        create: vi.fn(),
        del: vi.fn(),
    },
}));

vi.mock("@/api-server/prayer", () => ({
    updatePrayerEvents: vi.fn(),
}));

// Import Routes
import * as ClassesRoute from "@/app/api/hive/classes/route";
import * as ModulesRoute from "@/app/api/hive/modules/route";
import * as RoomsRoute from "@/app/api/hive/rooms/route";
import * as StudentsRoute from "@/app/api/hive/students/route";
import * as SubjectsRoute from "@/app/api/hive/subjects/route";
import * as UsersRoute from "@/app/api/hive/users/route";
import * as AvatarRoute from "@/app/api/hive/users/avatars/[slug]/route";
import * as SettingsRoute from "@/app/api/settings/[slug]/route";
import * as OutsidersRoute from "@/app/api/outsiders/route";
import * as NextAuthRoute from "@/app/api/auth/[...nextauth]/route";

import { getToken } from "next-auth/jwt";
import { getHiveStudents } from "@/api-server/hive/students";
import { DbSettings } from "@/api-server/db-settings";
import { DbOutsiders } from "@/api-server/db-outsiders";
import { updatePrayerEvents } from "@/api-server/prayer";

describe("Hive API Routes", () => {
    it("GET - classes", async () => {
        mockHiveClient.getClasses.mockResolvedValueOnce([{ id: "class1", name: "Class 1" }]);
        const request = new NextRequest("http://localhost/api/hive/classes");
        const response = await ClassesRoute.GET(request);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual([{ id: "class1", name: "Class 1" }]);
    });

    it("GET - modules", async () => {
        mockHiveClient.getModules.mockResolvedValueOnce([{ id: "mod1", name: "Module 1" }]);
        const request = new NextRequest("http://localhost/api/hive/modules");
        const response = await ModulesRoute.GET(request);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual([{ id: "mod1", name: "Module 1" }]);
    });

    it("GET - rooms", async () => {
        mockHiveClient.getRooms.mockResolvedValueOnce([{ id: "room1", name: "Room 1" }]);
        const request = new NextRequest("http://localhost/api/hive/rooms");
        const response = await RoomsRoute.GET(request);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual([{ id: "room1", name: "Room 1" }]);
    });

    it("GET - students", async () => {
        vi.mocked(getHiveStudents).mockResolvedValueOnce([{ id: "std1", name: "Student 1" }]);
        const request = new NextRequest("http://localhost/api/hive/students");
        const response = await StudentsRoute.GET(request);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual([{ id: "std1", name: "Student 1" }]);
    });

    it("GET - subjects", async () => {
        mockHiveClient.getSubjects.mockResolvedValueOnce([{ id: "sub1", name: "Subject 1" }]);
        const request = new NextRequest("http://localhost/api/hive/subjects");
        const response = await SubjectsRoute.GET(request);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual([{ id: "sub1", name: "Subject 1" }]);
    });

    it("GET - users", async () => {
        mockHiveClient.getUsers.mockResolvedValueOnce([{ id: "usr1", name: "User 1" }]);
        const request = new NextRequest("http://localhost/api/hive/users");
        const response = await UsersRoute.GET(request);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual([{ id: "usr1", name: "User 1" }]);
    });
});

describe("Avatar Proxy Route", () => {
    const originalFetch = global.fetch;
    afterEach(() => {
        global.fetch = originalFetch;
    });

    it("GET - unauthenticated request returns 401", async () => {
        vi.mocked(getToken).mockResolvedValueOnce(null);
        const request = new NextRequest("http://localhost/api/hive/users/avatars/user1");
        const context = { params: Promise.resolve({ slug: "user1" }) };
        const response = await AvatarRoute.GET(request, context);
        expect(response.status).toBe(401);
    });

    it("GET - authenticated proxy fetch success", async () => {
        vi.mocked(getToken).mockResolvedValueOnce({
            data: { accessToken: "mock-token" },
        } as unknown as Awaited<ReturnType<typeof getToken>>);

        global.fetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(8),
            headers: {
                get: (name: string) => name === "Content-Type" ? "image/png" : null,
            },
        } as unknown as Response);

        const request = new NextRequest("http://localhost/api/hive/users/avatars/user1");
        const context = { params: Promise.resolve({ slug: "user1" }) };
        const response = await AvatarRoute.GET(request, context);
        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("image/png");
    });
});

describe("Settings API Route", () => {
    const routeContext = { params: Promise.resolve({ slug: "prayerTimes" }) };

    it("GET - retrieves settings by name", async () => {
        vi.mocked(DbSettings.get).mockResolvedValueOnce({ shacharit: "06:00" });
        const request = new NextRequest("http://localhost/api/settings/prayerTimes");
        const response = await SettingsRoute.GET(request, routeContext);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual({ shacharit: "06:00" });
    });

    it("POST - updates settings and schedules prayers", async () => {
        const payload = { shacharit: "06:00", mincha: "13:00", arvit: "20:00" };
        const request = new NextRequest("http://localhost/api/settings/prayerTimes", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        const response = await SettingsRoute.POST(request, routeContext);
        expect(response.status).toBe(200);
        expect(DbSettings.set).toHaveBeenCalledWith(
            "prayerTimes",
            payload,
            undefined,
            expect.anything(),
        );
        expect(updatePrayerEvents).toHaveBeenCalled();
    });
});

describe("Outsiders API Route", () => {
    it("GET - returns list of outsiders", async () => {
        vi.mocked(DbOutsiders.get).mockResolvedValueOnce([{ id: "o1", name: "Outsider 1" }]);
        const request = new NextRequest("http://localhost/api/outsiders");
        const response = await OutsidersRoute.GET(request);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual([{ id: "o1", name: "Outsider 1" }]);
    });

    it("POST - updates outsider", async () => {
        const payload = { id: "o1", name: "Outsider 1" };
        const request = new NextRequest("http://localhost/api/outsiders", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        const response = await OutsidersRoute.POST(request);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual(payload);
        expect(DbOutsiders.set).toHaveBeenCalledWith(
            payload,
            undefined,
            expect.anything(),
        );
    });

    it("PUT - creates outsider", async () => {
        const payload = { id: "o1", name: "Outsider 1" };
        vi.mocked(DbOutsiders.create).mockResolvedValueOnce(payload);
        const request = new NextRequest("http://localhost/api/outsiders", {
            method: "PUT",
            body: JSON.stringify(payload),
        });
        const response = await OutsidersRoute.PUT(request);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual(payload);
    });

    it("DELETE - deletes outsider", async () => {
        const request = new NextRequest("http://localhost/api/outsiders", {
            method: "DELETE",
            body: JSON.stringify("o1"),
        });
        const response = await OutsidersRoute.DELETE(request);
        expect(response.status).toBe(200);
        expect(DbOutsiders.del).toHaveBeenCalledWith("o1", expect.anything());
    });
});

describe("NextAuth API Route", () => {
    beforeEach(() => {
        globalThis.mockNextAuthHandler.mockReset();
    });

    it("GET - forwards to NextAuth handler", async () => {
        const mockResponse = new NextResponse(JSON.stringify({ user: "admin" }));
        globalThis.mockNextAuthHandler.mockResolvedValueOnce(mockResponse);

        const request = new NextRequest("http://localhost/api/auth/session");
        const response = await NextAuthRoute.GET(request, {});
        expect(response).toBe(mockResponse);
        expect(globalThis.mockNextAuthHandler).toHaveBeenCalled();
    });

    it("GET - NextAuth failure returns 503 for session endpoint", async () => {
        globalThis.mockNextAuthHandler.mockRejectedValueOnce(new Error("SSO offline"));

        const request = new NextRequest("http://localhost/api/auth/session");
        const response = await NextAuthRoute.GET(request, {});
        const data = await response.json();
        expect(response.status).toBe(503);
        expect(data.error).toBe("Authentication service unavailable.");
    });
});
