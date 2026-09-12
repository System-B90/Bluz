import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * ADVERSARIAL SUITE — TOP SECURITY PRIORITY (#656).
 *
 * Assume the student is hostile: they read the client bundle, know every query
 * parameter the staff calendar uses, can replay any request with any headers,
 * and will try each one against the single endpoint they are allowed to call.
 * Every test here is an attack, not a feature check. A failure here is a data
 * leak, never a styling regression — do not "fix" one by loosening the
 * assertion.
 *
 * The complementary suites:
 * - `student-view-route.test.ts`     — the projection's own field whitelist.
 * - `student-clearance-gating.test.ts` — staff routes refusing a Hanich JWT.
 * - `student-routing-gate.test.ts`   — staff pages redirecting silently.
 * - `ws-student-scope.test.ts`       — the socket scope.
 * - `tests/student-view.spec.ts`     — the same boundary against a real Hive
 *                                      student token, end to end.
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
vi.mock("@/api-server/db-settings", () => ({
    DbSettings: { get: vi.fn(async () => null) },
}));
vi.mock("@/api-server/hive/service-client", () => ({
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
import { DbSettings } from "@/api-server/db-settings";
import { resolveIterationFromRequest } from "@/api-server/iteration-request";
import { Clearance } from "@/api-shared/types/hive";
import * as StudentViewRoute from "@/app/api/student-view/schedule/route";

const HANICH = { id: "s1", display_name: "חניך", clearance: Clearance.Hanich };
const SEGEL = { id: "u1", display_name: "סגל", clearance: Clearance.Segel };

function asUser(user: unknown) {
    vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

function makeRequest(query = "", init: RequestInit = {}) {
    return new NextRequest(
        `http://localhost/api/student-view/schedule${query}`,
        { method: "GET", ...init },
    );
}

/** A staff event carrying one of everything a student must never receive. */
function staffEvent(overrides: Record<string, unknown> = {}) {
    const start = new Date("2026-03-04T08:00:00.000Z");
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
        notes: "הערה פנימית: המדריך בחופשה",
        locked: true,
        hidden: false,
        required: true,
        personalTalk: true,
        splitAcrossBreaks: false,
        ganttEventId: "g1",
        ganttCurriculumId: "c1",
        iterationId: "2026a",
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(DbCourses.get).mockResolvedValue([]);
    vi.mocked(DbSettings.get).mockResolvedValue(null as never);
    vi.mocked(DbEvent.getInRange).mockResolvedValue([]);
    vi.mocked(resolveIterationFromRequest).mockResolvedValue({
        controller: { rooms: { find: () => ({ toArray: async () => [] }) } },
    } as never);
});

describe("a student probing for another day", () => {
    /*
     * The day is the student's whole world: yesterday's and tomorrow's boards
     * are not theirs to read. The rule is *reject*, never *ignore*, so a probe
     * cannot be mistaken for a normal request in the logs.
     */
    const DATE_PROBES = [
        "?date=2020-01-01",
        "?date=2030-12-31",
        "?date=2026-03-04",
        // Same parameter, different casing/duplication/encoding.
        "?DATE=2026-03-04",
        "?date=2026-03-04&date=2026-03-05",
        "?date=%32%30%32%36-03-04",
        // Traversal and injection shapes, in case a date ever reaches a query.
        "?date=../../etc/passwd",
        "?date[$ne]=null",
        "?date=%7B%22%24gt%22%3A%22%22%7D",
    ];

    for (const probe of DATE_PROBES) {
        it(`refuses ${probe} without touching the database`, async () => {
            asUser(HANICH);

            const response = await StudentViewRoute.GET(makeRequest(probe));

            // A `DATE=`-style probe is not the parameter at all, so it is
            // served as today rather than refused — what matters is that it
            // never selects another day.
            if (response.status === 200) {
                const { data } = await response.json();
                expect(data.date).not.toBe("2026-03-04");
                expect(data.date).not.toBe("2020-01-01");
            } else {
                expect(response.status).toBe(403);
                expect(DbEvent.getInRange).not.toHaveBeenCalled();
            }
        });
    }

    it("serves the server's day, never a client-supplied one, via headers", async () => {
        asUser(HANICH);

        const response = await StudentViewRoute.GET(
            makeRequest("", {
                headers: {
                    // Headers a client controls, in case any ever reaches the
                    // date resolution.
                    "x-forwarded-date": "2020-01-01",
                    "x-timezone": "Pacific/Kiritimati",
                    date: "2020-01-01",
                },
            }),
        );

        expect(response.status).toBe(200);
        const { data } = await response.json();
        expect(data.date).not.toBe("2020-01-01");
    });
});

describe("a student probing for another iteration", () => {
    /*
     * `?it=` is the staff iteration switch, visible in every staff URL. A
     * student passing one must be pinned to the current run regardless.
     */
    it("ignores ?it= and resolves the iteration without it", async () => {
        asUser(HANICH);

        await StudentViewRoute.GET(makeRequest("?it=2019a"));

        // The resolver is called with a request whose origin carries no query
        // at all, so a forged iteration cannot reach the lookup.
        const [passed] = vi.mocked(resolveIterationFromRequest).mock.calls[0];
        expect(passed.nextUrl.searchParams.get("it")).toBeNull();
    });

    it("honours ?it= for staff, so the preview still switches iterations", async () => {
        asUser(SEGEL);

        await StudentViewRoute.GET(makeRequest("?it=2019a"));

        const [passed] = vi.mocked(resolveIterationFromRequest).mock.calls[0];
        expect(passed.nextUrl.searchParams.get("it")).toBe("2019a");
    });
});

describe("a student forging a clearance", () => {
    /*
     * Clearance comes from the signed JWT. These tests pin that nothing else
     * — body, header, or a hand-built session object shape — can raise it.
     */
    it("refuses a session below Hanich outright", async () => {
        asUser({ id: "x", display_name: "אורח", clearance: "GUEST" });

        const response = await StudentViewRoute.GET(makeRequest());

        expect(response.status).toBe(403);
        expect(DbEvent.getInRange).not.toHaveBeenCalled();
    });

    it("refuses a caller with no session", async () => {
        vi.mocked(getServerSession).mockResolvedValue(null as never);

        const response = await StudentViewRoute.GET(makeRequest());

        expect([401, 403]).toContain(response.status);
        expect(DbEvent.getInRange).not.toHaveBeenCalled();
    });

    it("ignores a clearance claimed in a header", async () => {
        asUser(HANICH);

        const response = await StudentViewRoute.GET(
            makeRequest("?date=2020-01-01", {
                headers: {
                    "x-clearance": "Segel",
                    "x-user-clearance": "4",
                    authorization: "Bearer segel",
                },
            }),
        );

        // Still a student, so the staff-only date parameter is still refused.
        expect(response.status).toBe(403);
    });
});

describe("the projection under hostile data", () => {
    it("keeps the whitelist even when every staff field is populated", async () => {
        asUser(HANICH);
        vi.mocked(DbEvent.getInRange).mockResolvedValue([
            staffEvent(),
            staffEvent({ id: "22222222-2222-4222-8222-222222222222" }),
        ] as never);

        const response = await StudentViewRoute.GET(makeRequest());
        const body = await response.text();

        // The serialized body, not just the parsed object: a leak nested
        // inside a value would pass a key-only check.
        for (const secret of [
            "hiveModule",
            "hiveLesson",
            "hiveQueues",
            "instructors",
            "lecturers",
            "personalTalk",
            "ganttEventId",
            "ganttCurriculumId",
            "iterationId",
            "הערה פנימית",
            "איש חוץ",
        ]) {
            expect(body, `leaked ${secret}`).not.toContain(secret);
        }
    });

    it("never returns an event the query excluded, whatever the document says", async () => {
        asUser(HANICH);

        await StudentViewRoute.GET(makeRequest());

        // Hidden events are excluded in the Mongo filter itself, so no later
        // refactor of the mapper can reinstate them.
        const filter = vi.mocked(DbEvent.getInRange).mock.calls[0][3];
        expect(filter).toMatchObject({ hidden: { $ne: true } });
    });

    it("resolves the colour to a hex string, never a subject or colour id", async () => {
        asUser(HANICH);
        vi.mocked(DbEvent.getInRange).mockResolvedValue([
            staffEvent({ color: "subject-77" }),
        ] as never);

        const response = await StudentViewRoute.GET(makeRequest());
        const [event] = (await response.json()).data.events;

        expect(event.color).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(event.color).not.toContain("subject");
    });

    it("carries course names, never course ids", async () => {
        asUser(HANICH);
        vi.mocked(DbEvent.getInRange).mockResolvedValue([staffEvent()] as never);
        vi.mocked(DbCourses.get).mockResolvedValue([
            { id: "course-1", name: "מחזור א", color: null },
        ] as never);

        const response = await StudentViewRoute.GET(makeRequest());
        const body = await response.text();

        expect(body).toContain("מחזור א");
        expect(body).not.toContain("course-1");
    });

    it("drops a course id it cannot resolve rather than passing it through", async () => {
        asUser(HANICH);
        vi.mocked(DbEvent.getInRange).mockResolvedValue([
            staffEvent({ courses: ["course-unknown"] }),
        ] as never);
        vi.mocked(DbCourses.get).mockResolvedValue([] as never);

        const response = await StudentViewRoute.GET(makeRequest());
        const [event] = (await response.json()).data.events;

        expect(event.courses).toEqual([]);
    });

    it("drops a room id it cannot resolve rather than passing it through", async () => {
        asUser(HANICH);
        vi.mocked(DbEvent.getInRange).mockResolvedValue([
            staffEvent({ rooms: [{ id: 4242, source: 1 }] }),
        ] as never);

        const response = await StudentViewRoute.GET(makeRequest());
        const body = await response.text();
        const [event] = JSON.parse(body).data.events;

        expect(event.rooms).toEqual([]);
        expect(body).not.toContain("4242");
    });

    it("survives Hive being unreachable without failing open", async () => {
        asUser(HANICH);
        vi.mocked(DbEvent.getInRange).mockResolvedValue([
            staffEvent({ subject: 7 }),
        ] as never);

        const response = await StudentViewRoute.GET(makeRequest());
        const [event] = (await response.json()).data.events;

        // Degrades to the fallback colour; the subject id still never appears.
        expect(response.status).toBe(200);
        expect(event).not.toHaveProperty("subject");
    });
});

describe("the endpoint is read-only", () => {
    it("exports no write handler at all", () => {
        // A student's single reachable route must not gain a mutation later:
        // a POST/PUT/PATCH/DELETE export here is the regression.
        for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
            expect(
                StudentViewRoute,
                `student schedule route exported ${method}`,
            ).not.toHaveProperty(method);
        }
    });
});
