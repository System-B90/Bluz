import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * `/api/student-view/schedule` is the single endpoint a student ("חניך")
 * session may call, so these tests are about a security boundary rather than a
 * rendering preference (#656): what a student can ask for, and what comes back
 * when they do.
 */

vi.mock("@/api-server/db-event", () => ({
    DbEvent: { getInRange: vi.fn() },
}));
vi.mock("@/api-server/db-courses", () => ({
    DbCourses: { get: vi.fn(async () => []) },
}));
vi.mock("@/api-server/db-custom-colors", () => ({
    DbCustomColors: { get: vi.fn(async () => []) },
}));
vi.mock("@/api-server/hive/service-client", () => ({
    // Hive unreachable in unit tests; the projection must degrade, not throw.
    createHiveServiceClient: vi.fn(async () => {
        throw new Error("no hive");
    }),
}));
vi.mock("@/api-server/iteration-request", () => ({
    resolveIterationFromRequest: vi.fn(async () => ({
        controller: { rooms: { find: () => ({ toArray: async () => [] }) } },
    })),
}));

import { DbCourses } from "@/api-server/db-courses";
import { DbEvent } from "@/api-server/db-event";
import { Clearance } from "@/api-shared/types/hive";
import * as StudentViewRoute from "@/app/api/student-view/schedule/route";

const HANICH = { id: "s1", display_name: "חניך", clearance: Clearance.Hanich };
const SEGEL = { id: "u1", display_name: "סגל", clearance: Clearance.Segel };

function asUser(user: unknown) {
    vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

function makeRequest(query = "") {
    return new NextRequest(
        `http://localhost/api/student-view/schedule${query}`,
        { method: "GET" },
    );
}

/** A full staff event document, i.e. everything a student must not receive. */
function staffEvent(overrides: Record<string, unknown> = {}) {
    const start = new Date();
    return {
        id: "11111111-1111-4111-8111-111111111111",
        name: "שיעור",
        subject: 7,
        hiveModule: 42,
        hiveLesson: 99,
        hiveQueues: { "course-1": 5 },
        startTime: start,
        endTime: new Date(start.getTime() + 3_600_000),
        type: "הרצאה",
        courses: ["course-1"],
        rooms: [],
        instructors: [3, 4],
        lecturers: ["איש חוץ"],
        tags: [1],
        notes: "הערה פנימית",
        locked: true,
        hidden: false,
        required: true,
        personalTalk: true,
        splitAcrossBreaks: false,
        color: undefined,
        ganttEventId: "g1",
        ganttCurriculumId: "c1",
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(DbCourses.get).mockResolvedValue([]);
});

describe("GET /api/student-view/schedule — access", () => {
    it("serves a Hanich session", async () => {
        asUser(HANICH);
        vi.mocked(DbEvent.getInRange).mockResolvedValue([]);

        const response = await StudentViewRoute.GET(makeRequest());
        expect(response.status).toBe(200);
    });

    it("rejects an unauthenticated caller", async () => {
        vi.mocked(getServerSession).mockResolvedValue(null as never);

        const response = await StudentViewRoute.GET(makeRequest());
        expect(response.status).not.toBe(200);
        expect(DbEvent.getInRange).not.toHaveBeenCalled();
    });

    it("rejects a ?date= probe from a student rather than ignoring it", async () => {
        asUser(HANICH);

        const response = await StudentViewRoute.GET(
            makeRequest("?date=2020-01-01"),
        );
        expect(response.status).toBe(403);
        expect(DbEvent.getInRange).not.toHaveBeenCalled();
    });

    it("honours ?date= for a staff preview", async () => {
        asUser(SEGEL);
        vi.mocked(DbEvent.getInRange).mockResolvedValue([]);

        const response = await StudentViewRoute.GET(
            makeRequest("?date=2026-03-04"),
        );
        expect(response.status).toBe(200);
        expect((await response.json()).data.date).toBe("2026-03-04");
    });
});

describe("GET /api/student-view/schedule — projection", () => {
    it("returns only the whitelisted fields, never a staff field", async () => {
        asUser(HANICH);
        vi.mocked(DbEvent.getInRange).mockResolvedValue([staffEvent()] as never);
        vi.mocked(DbCourses.get).mockResolvedValue([
            { id: "course-1", name: "מחזור א", color: null },
        ] as never);

        const response = await StudentViewRoute.GET(makeRequest());
        const [event] = (await response.json()).data.events;

        expect(Object.keys(event).sort()).toEqual([
            "color",
            "courses",
            "endTime",
            "id",
            "name",
            "rooms",
            "startTime",
        ]);
        expect(event.name).toBe("שיעור");
        expect(event.courses).toEqual(["מחזור א"]);

        // Spelled out individually so a regression names the field it leaked.
        for (const field of [
            "subject",
            "hiveModule",
            "hiveLesson",
            "hiveQueues",
            "type",
            "instructors",
            "lecturers",
            "tags",
            "notes",
            "locked",
            "hidden",
            "required",
            "personalTalk",
            "ganttEventId",
            "ganttCurriculumId",
        ]) {
            expect(event, `leaked ${field}`).not.toHaveProperty(field);
        }
    });

    it("excludes hidden events in the database query itself", async () => {
        asUser(HANICH);
        vi.mocked(DbEvent.getInRange).mockResolvedValue([]);

        await StudentViewRoute.GET(makeRequest());

        const filter = vi.mocked(DbEvent.getInRange).mock.calls[0][3];
        expect(filter).toMatchObject({ hidden: { $ne: true } });
    });

    it("queries exactly one day", async () => {
        asUser(SEGEL);
        vi.mocked(DbEvent.getInRange).mockResolvedValue([]);

        await StudentViewRoute.GET(makeRequest("?date=2026-03-04"));

        const [start, end] = vi.mocked(DbEvent.getInRange).mock.calls[0];
        expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it("returns fake events as ordinary ones", async () => {
        asUser(HANICH);
        vi.mocked(DbEvent.getInRange).mockResolvedValue([
            staffEvent({ fake: true, name: "פיקטיבי" }),
        ] as never);

        const response = await StudentViewRoute.GET(makeRequest());
        const [event] = (await response.json()).data.events;

        expect(event.name).toBe("פיקטיבי");
        expect(event).not.toHaveProperty("fake");
    });

    it("resolves a colour id to a hex value so no subject id crosses the wire", async () => {
        asUser(HANICH);
        vi.mocked(DbEvent.getInRange).mockResolvedValue([
            staffEvent({ color: "custom-1" }),
        ] as never);
        const { DbCustomColors } = await import("@/api-server/db-custom-colors");
        vi.mocked(DbCustomColors.get).mockResolvedValue([
            { id: "custom-1", name: "כחול", hex: "#3f51b5" },
        ]);

        const response = await StudentViewRoute.GET(makeRequest());
        const [event] = (await response.json()).data.events;

        expect(event.color).toBe("#3f51b5");
    });
});
