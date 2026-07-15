import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// requireStaffSession() -> getServerSession() calls next/headers, which throws
// outside a real Next.js request scope (vitest). Resolve a Segel session so the
// #199 auth gate passes and the routes under test run their actual logic.
vi.mock("next-auth", () => ({
    getServerSession: vi.fn(async () => ({
        user: {
            id: "test-user",
            display_name: "Test User",
            clearance: 3, // Clearance.Segel (literal: vi.mock factories are hoisted above imports)
        },
    })),
}));

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
