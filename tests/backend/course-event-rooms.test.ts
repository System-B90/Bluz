import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock DbCourses
vi.mock("@/api-server/db-courses", () => ({
    DbCourses: {
        get: vi.fn(),
        set: vi.fn(),
        create: vi.fn(),
        del: vi.fn(),
    },
}));

// Mock DbEvent
vi.mock("@/api-server/db-event", () => ({
    DbEvent: {
        get: vi.fn(),
        getMultiple: vi.fn(),
        getInRange: vi.fn(),
        set: vi.fn(),
        create: vi.fn(),
        del: vi.fn(),
    },
}));

// Mock DbRooms and DbRoomExtendedInfo
vi.mock("@/api-server/db-rooms", () => ({
    DbRooms: {
        set: vi.fn(),
        create: vi.fn(),
        del: vi.fn(),
    },
}));

vi.mock("@/api-server/db-room-extended-info", () => ({
    DbRoomExtendedInfo: {
        upsert: vi.fn(),
    },
}));

// Mock getAllRooms helper
vi.mock("@/app/api/rooms/utils", () => ({
    getAllRooms: vi.fn(),
}));

import * as CourseRoute from "@/app/api/course/route";
import * as EventRoute from "@/app/api/event/route";
import * as RoomsRoute from "@/app/api/rooms/route";
import { DbCourses } from "@/api-server/db-courses";
import { DbEvent } from "@/api-server/db-event";
import { DbRooms } from "@/api-server/db-rooms";
import { DbRoomExtendedInfo } from "@/api-server/db-room-extended-info";
import { getAllRooms } from "@/app/api/rooms/utils";

describe("Course API Route", () => {
    it("GET - returns list of courses", async () => {
        const mockCourses = [{ id: "c1", title: "Course 1" }];
        vi.mocked(DbCourses.get).mockResolvedValueOnce(mockCourses);

        const request = new NextRequest("http://localhost/api/course");
        const response = await CourseRoute.GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toEqual(mockCourses);
    });

    it("POST - updates a course", async () => {
        const coursePayload = { id: "c1", title: "Updated Course 1" };
        const request = new NextRequest("http://localhost/api/course", {
            method: "POST",
            body: JSON.stringify(coursePayload),
        });
        const response = await CourseRoute.POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toEqual(coursePayload);
        expect(DbCourses.set).toHaveBeenCalledWith(
            coursePayload,
            undefined,
            expect.anything(),
        );
    });

    it("DELETE - deletes a course", async () => {
        const request = new NextRequest("http://localhost/api/course", {
            method: "DELETE",
            body: JSON.stringify("c1"),
        });
        const response = await CourseRoute.DELETE(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(DbCourses.del).toHaveBeenCalledWith("c1", expect.anything());
    });

    it("PUT - creates a course", async () => {
        const coursePayload = { id: "c2", title: "New Course" };
        vi.mocked(DbCourses.create).mockResolvedValueOnce(coursePayload);

        const request = new NextRequest("http://localhost/api/course", {
            method: "PUT",
            body: JSON.stringify(coursePayload),
        });
        const response = await CourseRoute.PUT(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toEqual(coursePayload);
        expect(DbCourses.create).toHaveBeenCalledWith(
            coursePayload,
            expect.anything(),
        );
    });
});

describe("Event API Route", () => {
    it("GET - single event by id", async () => {
        const mockEvent = { id: "e1", title: "Event 1" };
        vi.mocked(DbEvent.get).mockResolvedValueOnce(mockEvent);

        const request = new NextRequest("http://localhost/api/event?id=e1");
        const response = await EventRoute.GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toEqual(mockEvent);
        expect(DbEvent.get).toHaveBeenCalledWith(
            "e1",
            undefined,
            expect.anything(),
        );
    });

    it("GET - multiple events by ids", async () => {
        const mockId = "e12345678901234567890123";
        const mockEvents = [{ id: mockId, title: "Event 1" }];
        vi.mocked(DbEvent.getMultiple).mockResolvedValueOnce(mockEvents);

        const request = new NextRequest(`http://localhost/api/event?ids=${mockId}`);
        const response = await EventRoute.GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toEqual({ [mockId]: mockEvents[0] });
        expect(DbEvent.getMultiple).toHaveBeenCalledWith(
            [mockId],
            undefined,
            expect.anything(),
        );
    });

    it("GET - events in date range", async () => {
        const mockEvents = [{ id: "e1", title: "Event 1" }];
        vi.mocked(DbEvent.getInRange).mockResolvedValueOnce(mockEvents);

        const request = new NextRequest("http://localhost/api/event?sd=2026-06-01&ed=2026-06-30");
        const response = await EventRoute.GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toEqual(mockEvents);
        expect(DbEvent.getInRange).toHaveBeenCalled();
    });

    it("POST - updates an event", async () => {
        const eventPayload = { id: "e1", title: "Updated Event" };
        vi.mocked(DbEvent.set).mockResolvedValueOnce(eventPayload);

        const request = new NextRequest("http://localhost/api/event", {
            method: "POST",
            body: JSON.stringify(eventPayload),
        });
        const response = await EventRoute.POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toEqual(eventPayload);
    });

    it("PUT - creates an event", async () => {
        const eventPayload = { id: "e1", title: "New Event" };
        vi.mocked(DbEvent.create).mockResolvedValueOnce(eventPayload);

        const request = new NextRequest("http://localhost/api/event", {
            method: "PUT",
            body: JSON.stringify(eventPayload),
        });
        const response = await EventRoute.PUT(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toEqual(eventPayload);
    });

    it("DELETE - deletes an event", async () => {
        const request = new NextRequest("http://localhost/api/event", {
            method: "DELETE",
            body: JSON.stringify("e1"),
        });
        const response = await EventRoute.DELETE(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(DbEvent.del).toHaveBeenCalledWith(
            "e1",
            undefined,
            expect.anything(),
            undefined,
        );
    });
});

describe("Rooms API Route", () => {
    it("GET - returns all rooms with extended info", async () => {
        const mockRooms = [{ id: "r1", title: "Room 1" }];
        vi.mocked(getAllRooms).mockResolvedValueOnce(mockRooms);

        const request = new NextRequest("http://localhost/api/rooms");
        const response = await RoomsRoute.GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toEqual(mockRooms);
    });

    it("POST - updates custom room", async () => {
        const roomPayload = { id: "r1", name: "Custom Room" };
        const request = new NextRequest("http://localhost/api/rooms", {
            method: "POST",
            body: JSON.stringify(roomPayload),
        });
        const response = await RoomsRoute.POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toEqual(roomPayload);
        expect(DbRooms.set).toHaveBeenCalledWith(
            roomPayload,
            undefined,
            expect.anything(),
        );
    });

    it("PUT - creates custom room", async () => {
        const roomPayload = { id: "r1", name: "Custom Room" };
        vi.mocked(DbRooms.create).mockResolvedValueOnce(roomPayload);

        const request = new NextRequest("http://localhost/api/rooms", {
            method: "PUT",
            body: JSON.stringify(roomPayload),
        });
        const response = await RoomsRoute.PUT(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toEqual(roomPayload);
        expect(DbRooms.create).toHaveBeenCalledWith(
            roomPayload,
            expect.anything(),
        );
    });

    it("DELETE - deletes custom room", async () => {
        const request = new NextRequest("http://localhost/api/rooms", {
            method: "DELETE",
            body: JSON.stringify("r1"),
        });
        const response = await RoomsRoute.DELETE(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(DbRooms.del).toHaveBeenCalledWith("r1", expect.anything());
    });

    it("PATCH - updates room extended info", async () => {
        const patchPayload = { roomId: "r1", roomSource: "custom", extendedInfo: { workstationCount: 10 } };
        const request = new NextRequest("http://localhost/api/rooms", {
            method: "PATCH",
            body: JSON.stringify(patchPayload),
        });
        const response = await RoomsRoute.PATCH(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(DbRoomExtendedInfo.upsert).toHaveBeenCalledWith(
            "r1",
            "custom",
            { workstationCount: 10 },
            expect.anything(),
        );
    });
});
