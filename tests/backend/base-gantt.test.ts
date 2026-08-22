import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// Bypass requireStaffSession()'s getServerSession() call, which touches
// next/headers outside a request scope in vitest (#223).
vi.mock("next-auth", async () => {
    const { Clearance } = await import("@/api-shared/types/hive");
    return {
        default: vi.fn(() => vi.fn()),
        getServerSession: vi.fn(async () => ({
            user: {
                id: "test-user",
                display_name: "Test User",
                clearance: Clearance.Admin,
            },
        })),
    };
});

vi.mock("@/api-server/hive/sso", () => ({
    authOptions: {},
}));

import { sanitizeUpdatePayload } from "@/api-server/gantt/db-base";
import {
    ganttEventsSchema,
    ganttModulesSchema,
} from "@/api-server/gantt/schema";
import { buildGantCollectionRoutes } from "@/app/api/gantt/base-collection";
import { buildGantItemRoutes } from "@/app/api/gantt/base-item";
import { buildGantAllocateTimeRoutes } from "@/app/api/gantt/base-allocate-time";
import { buildGantLinkRoutes } from "@/app/api/gantt/base-link";

describe("Base Gantt Collection Routes", () => {
    const mockDbSet = {
        listItems: vi.fn(),
        getMultipleItems: vi.fn(),
        getItem: vi.fn(),
        createNewItem: vi.fn(),
        updateItem: vi.fn(),
        deleteItem: vi.fn(),
    };

    const routes = buildGantCollectionRoutes({ dbSet: mockDbSet });

    it("GET - list all items", async () => {
        mockDbSet.listItems.mockResolvedValueOnce({ "1": "Item 1" });
        const request = new NextRequest("http://localhost/api/gantt");
        const response = await routes.GET(request);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual({ "1": "Item 1" });
    });

    it("GET - list defaults to the flat label map (no withParents)", async () => {
        mockDbSet.listItems.mockResolvedValueOnce({ "1": "Item 1" });
        const request = new NextRequest("http://localhost/api/gantt");
        await routes.GET(request);
        // The flat shape is the published contract; the parent-bearing shape
        // must stay opt-in so existing callers are unaffected. See #310.
        expect(mockDbSet.listItems).toHaveBeenCalledWith(false);
    });

    it("GET - ?withParents=1 asks the db layer for parent ids", async () => {
        mockDbSet.listItems.mockResolvedValueOnce({
            "1": { title: "Item 1", syllabusId: "s_1" },
        });
        const request = new NextRequest(
            "http://localhost/api/gantt?withParents=1",
        );
        const response = await routes.GET(request);
        const data = await response.json();
        expect(mockDbSet.listItems).toHaveBeenCalledWith(true);
        expect(response.status).toBe(200);
        expect(data.data).toEqual({
            "1": { title: "Item 1", syllabusId: "s_1" },
        });
    });

    it.each([
        ["withParents", true],
        ["withParents=true", true],
        ["withParents=yes", true],
        ["withParents=0", false],
        ["withParents=false", false],
    ])("GET - ?%s parses to %s", async (query, expected) => {
        mockDbSet.listItems.mockResolvedValueOnce({});
        const request = new NextRequest(`http://localhost/api/gantt?${query}`);
        await routes.GET(request);
        expect(mockDbSet.listItems).toHaveBeenCalledWith(expected);
    });

    it("GET - list multiple items by ids", async () => {
        mockDbSet.getMultipleItems.mockResolvedValueOnce([{ id: "1", title: "Item 1" }]);
        const request = new NextRequest("http://localhost/api/gantt?ids=1");
        const response = await routes.GET(request);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual({ "1": { id: "1", title: "Item 1" } });
    });

    it("POST - create new item", async () => {
        mockDbSet.createNewItem.mockResolvedValueOnce({ id: "2", title: "Item 2" });
        const request = new NextRequest("http://localhost/api/gantt", {
            method: "POST",
            body: JSON.stringify({ title: "Item 2" }),
        });
        const response = await routes.POST(request);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual({ id: "2", title: "Item 2" });
    });
});

describe("Base Gantt Item Routes", () => {
    const mockDbSet = {
        listItems: vi.fn(),
        getMultipleItems: vi.fn(),
        getItem: vi.fn(),
        createNewItem: vi.fn(),
        updateItem: vi.fn(),
        deleteItem: vi.fn(),
    };

    const routes = buildGantItemRoutes({ dbSet: mockDbSet });

    it("GET - get single item", async () => {
        mockDbSet.getItem.mockResolvedValueOnce({ id: "1", title: "Item 1" });
        const request = new NextRequest("http://localhost/api/gantt/1");
        const context = { params: Promise.resolve({ id: "1" }) };
        const response = await routes.GET(request, context);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual({ id: "1", title: "Item 1" });
    });

    it("PATCH - update item", async () => {
        mockDbSet.updateItem.mockResolvedValueOnce({ id: "1", title: "Updated Title" });
        const request = new NextRequest("http://localhost/api/gantt/1", {
            method: "PATCH",
            body: JSON.stringify({ title: "Updated Title" }),
        });
        const context = { params: Promise.resolve({ id: "1" }) };
        const response = await routes.PATCH(request, context);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual({ id: "1", title: "Updated Title" });
    });

    it("DELETE - delete item", async () => {
        const request = new NextRequest("http://localhost/api/gantt/1", {
            method: "DELETE",
        });
        const context = { params: Promise.resolve({ id: "1" }) };
        const response = await routes.DELETE(request, context);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual({ deleted: true, id: "1" });
    });
});

describe("Base Gantt Allocate Time Routes", () => {
    const mockDbSet = {
        getAllocatedTime: vi.fn(),
        setAllocatedTime: vi.fn(),
    };

    const routes = buildGantAllocateTimeRoutes({ dbSet: mockDbSet });

    it("GET - get allocated time", async () => {
        mockDbSet.getAllocatedTime.mockResolvedValueOnce(5);
        const request = new NextRequest("http://localhost/api/gantt/1/allocate-time?containerId=c1");
        const context = { params: Promise.resolve({ id: "1" }) };
        const response = await routes.GET(request, context);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toBe(5);
    });

    it("POST - set allocated time", async () => {
        const request = new NextRequest("http://localhost/api/gantt/1/allocate-time", {
            method: "POST",
            body: JSON.stringify({ containerId: "c1", duration: 8 }),
        });
        const context = { params: Promise.resolve({ id: "1" }) };
        const response = await routes.POST(request, context);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual({ success: true });
    });
});

describe("Base Gantt Link Routes", () => {
    const mockDbSet = {
        linkItem: vi.fn(),
        unlinkItem: vi.fn(),
    };

    const routes = buildGantLinkRoutes({ dbSet: mockDbSet });

    it("POST - link item", async () => {
        mockDbSet.linkItem.mockResolvedValueOnce({ id: "1", parentId: "p1" });
        const request = new NextRequest("http://localhost/api/gantt/1/link", {
            method: "POST",
            body: JSON.stringify({ newParentId: "p1" }),
        });
        const context = { params: Promise.resolve({ id: "1" }) };
        const response = await routes.POST(request, context);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual({ id: "1", parentId: "p1" });
    });

    it("DELETE - unlink item", async () => {
        const request = new NextRequest("http://localhost/api/gantt/1/link", {
            method: "DELETE",
            body: JSON.stringify({ oldParentId: "p1" }),
        });
        const context = { params: Promise.resolve({ id: "1" }) };
        const response = await routes.DELETE(request, context);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual({ unlinked: true, id: "1" });
    });
});

describe("sanitizeUpdatePayload (#519)", () => {
    it("drops unknown and server-owned fields", () => {
        const result = sanitizeUpdatePayload(
            ganttModulesSchema,
            {
                id: "mod_evil",
                createdAt: new Date(0),
                updatedAt: new Date(0),
                title: "New title",
                notAColumn: "ignored",
            },
            "מודול",
        );

        expect(result).toEqual({ title: "New title" });
    });

    it("rejects a value outside an enum column's members", () => {
        expect(() =>
            sanitizeUpdatePayload(
                ganttEventsSchema,
                { type: "definitely-not-a-type" },
                "אירוע",
            ),
        ).toThrow();
    });
});
