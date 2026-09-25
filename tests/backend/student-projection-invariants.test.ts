import { getServerSession } from "next-auth";
import { resolveStudentSchedule } from "@/api-shared/student-schedule";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * ADVERSARIAL SUITE — TOP SECURITY PRIORITY (#656).
 *
 * The gate functions and the projection builder on their own, without a route
 * in the way. The route suites prove the wiring; this one proves the two
 * pieces the wiring depends on cannot be talked into misbehaving:
 *
 * - `requireStudentViewSession` — exactly which clearances pass.
 * - `resolveStudentViewDate`    — a student can never name a day.
 * - `buildStudentSchedule`      — the projection holds for any document shape,
 *                                 including ones the database should never
 *                                 hold but might after a bad migration.
 */

vi.mock("@/api-server/db-event", () => ({
    DbEvent: { getInRange: vi.fn(async () => []) },
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

import { DbCourses } from "@/api-server/db-courses";
import { DbCustomColors } from "@/api-server/db-custom-colors";
import { DbEvent } from "@/api-server/db-event";
import { createHiveServiceClient } from "@/api-server/hive/service-client";
import {
    buildStudentSchedule,
    requireStudentViewSession,
    resolveStudentViewDate,
} from "@/api-server/student-view";
import { Clearance } from "@/api-shared/types/hive";

/** A controller with no custom rooms — the Hive lookup is mocked to fail. */
const CONTROLLER = {
    rooms: { find: () => ({ toArray: async () => [] }) },
} as never;

function asUser(user: unknown) {
    vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(DbEvent.getInRange).mockResolvedValue([]);
    vi.mocked(DbCourses.get).mockResolvedValue([]);
    vi.mocked(DbCustomColors.get).mockResolvedValue([]);
});

describe("requireStudentViewSession — who gets in", () => {
    it("admits Hanich as a non-staff caller", async () => {
        asUser({ id: "s1", clearance: Clearance.Hanich });

        const session = await requireStudentViewSession();

        expect(session.isStaff).toBe(false);
        expect(session.userId).toBe("s1");
    });

    for (const clearance of [Clearance.Segel, Clearance.Admin]) {
        it(`admits ${clearance} as staff`, async () => {
            asUser({ id: "u1", clearance });

            expect((await requireStudentViewSession()).isStaff).toBe(true);
        });
    }

    /** Anything that is not one of the three real clearances. */
    const REJECTED = [
        undefined,
        null,
        "",
        "Segel",
        "segel",
        "ADMIN",
        0,
        -1,
        999,
        { valueOf: () => Clearance.Admin },
        ["Admin"],
    ];

    for (const clearance of REJECTED) {
        it(`refuses a session claiming clearance ${JSON.stringify(clearance)}`, async () => {
            asUser({ id: "x", clearance });

            await expect(requireStudentViewSession()).rejects.toThrow();
        });
    }

    it("refuses when there is no session at all", async () => {
        vi.mocked(getServerSession).mockResolvedValue(null as never);

        await expect(requireStudentViewSession()).rejects.toThrow();
    });

    it("refuses a session object with no user", async () => {
        vi.mocked(getServerSession).mockResolvedValue({} as never);

        await expect(requireStudentViewSession()).rejects.toThrow();
    });

    it("takes the user id from the session, never from anywhere else", async () => {
        asUser({ id: "s1", clearance: Clearance.Hanich, userId: "someone-else" });

        expect((await requireStudentViewSession()).userId).toBe("s1");
    });
});

describe("resolveStudentViewDate — whose day it is", () => {
    it("gives a student the server's day when they ask for nothing", () => {
        expect(resolveStudentViewDate(null, false)).toMatch(
            /^\d{4}-\d{2}-\d{2}$/,
        );
    });

    /** Every shape a student might put in `?date=`. */
    const STUDENT_PROBES = [
        "2020-01-01",
        "2030-12-31",
        "today",
        "now",
        "0000-00-00",
        "9999-99-99",
        "2026-03-04T00:00:00Z",
        "../../../etc/passwd",
        '{"$ne":null}',
        "1",
        " ",
    ];

    for (const probe of STUDENT_PROBES) {
        it(`refuses ${JSON.stringify(probe)} from a student`, () => {
            expect(() => resolveStudentViewDate(probe, false)).toThrow();
        });
    }

    it("accepts a well-formed date from staff", () => {
        expect(resolveStudentViewDate("2026-03-04", true)).toBe("2026-03-04");
    });

    it("refuses a malformed date even from staff", () => {
        expect(() => resolveStudentViewDate("not-a-date", true)).toThrow();
    });
});

describe("buildStudentSchedule — the projection cannot be widened by data", () => {
    /** Every key the projection is allowed to carry, and no other. */
    const ALLOWED_EVENT_KEYS = [
        "color",
        "courses",
        "endTime",
        "id",
        "name",
        "relatedCourses",
        "rooms",
        "startTime",
    ];

    /**
     * Documents that should not exist but might: extra fields from a partial
     * migration, nested objects, prototype-pollution shapes, values of the
     * wrong type. None of them may add a key to the projection.
     */
    const HOSTILE_DOCUMENTS: Array<[string, Record<string, unknown>]> = [
        [
            "a document carrying an unexpected top-level field",
            { secretPayroll: "₪", internalScore: 91 },
        ],
        [
            "a document whose name is an object",
            { name: { toString: () => "שיעור", secret: "הערה" } },
        ],
        [
            "a document with a nested staff blob",
            { meta: { instructors: [1, 2], notes: "פנימי" } },
        ],
        [
            "a document with an inherited property",
            Object.create({ inheritedSecret: "leak" }) as Record<string, unknown>,
        ],
        ["a document with a __proto__ key", { ["__proto__"]: { leaked: true } }],
        ["a document with null rooms and courses", { rooms: null, courses: null }],
        [
            "a document whose courses are objects rather than ids",
            { courses: [{ id: "c1", name: "מחזור א", secret: "x" }] },
        ],
    ];

    function baseEvent(overrides: Record<string, unknown> = {}) {
        const start = new Date("2026-03-04T08:00:00.000Z");
        return {
            id: "11111111-1111-4111-8111-111111111111",
            name: "שיעור",
            startTime: start,
            endTime: new Date(start.getTime() + 3_600_000),
            courses: [],
            rooms: [],
            ...overrides,
        };
    }

    for (const [label, overrides] of HOSTILE_DOCUMENTS) {
        it(`projects only the allowed keys from ${label}`, async () => {
            vi.mocked(DbEvent.getInRange).mockResolvedValue([
                baseEvent(overrides),
            ] as never);

            const result = await buildStudentSchedule("2026-03-04", CONTROLLER);
            const [event] = result.events;

            expect(Object.keys(event).sort()).toEqual(ALLOWED_EVENT_KEYS);
            // Own *and* inherited: `for...in` over the projection must not
            // reach anything either.
            const reachable: Array<string> = [];
            for (const key in event) reachable.push(key);
            expect(reachable.sort()).toEqual(ALLOWED_EVENT_KEYS);
        });
    }

    it("serializes to a body naming no staff field, for a whole day of events", async () => {
        vi.mocked(DbEvent.getInRange).mockResolvedValue(
            Array.from({ length: 50 }, (_, index) =>
                baseEvent({
                    id: `event-${index}`,
                    hiveLesson: index,
                    hiveModule: index,
                    instructors: [index],
                    notes: `סוד ${index}`,
                    subject: index,
                }),
            ) as never,
        );

        const body = JSON.stringify(
            await buildStudentSchedule("2026-03-04", CONTROLLER),
        );

        for (const secret of [
            "hiveLesson",
            "hiveModule",
            "instructors",
            "notes",
            "subject",
            "סוד",
        ]) {
            expect(body, `leaked ${secret}`).not.toContain(secret);
        }
    });

    it("always returns a hex colour, whatever the document holds", async () => {
        const COLOUR_INPUTS = [
            undefined,
            null,
            "",
            "subject-42",
            "custom-unknown",
            12345,
            { hex: "#ffffff" },
        ];
        vi.mocked(DbEvent.getInRange).mockResolvedValue(
            COLOUR_INPUTS.map((color, index) =>
                baseEvent({ color, id: `event-${index}` }),
            ) as never,
        );

        const { events } = await buildStudentSchedule("2026-03-04", CONTROLLER);

        for (const event of events) {
            expect(event.color, JSON.stringify(event.color)).toMatch(
                /^#[0-9a-fA-F]{6}$/,
            );
        }
    });

    it("emits ISO timestamps, not raw database values", async () => {
        vi.mocked(DbEvent.getInRange).mockResolvedValue([
            baseEvent({ startTime: "2026-03-04T08:00:00.000Z" }),
        ] as never);

        const [event] = (await buildStudentSchedule("2026-03-04", CONTROLLER))
            .events;

        expect(event.startTime).toBe("2026-03-04T08:00:00.000Z");
        expect(new Date(event.endTime).toISOString()).toBe(event.endTime);
    });

    it("sorts by start time, so the order reveals nothing about storage", async () => {
        vi.mocked(DbEvent.getInRange).mockResolvedValue([
            baseEvent({ id: "b", startTime: new Date("2026-03-04T10:00:00Z") }),
            baseEvent({ id: "a", startTime: new Date("2026-03-04T07:00:00Z") }),
        ] as never);

        const { events } = await buildStudentSchedule("2026-03-04", CONTROLLER);

        expect(events.map((event) => event.id)).toEqual(["a", "b"]);
    });

    it("relates an event to its shuffle's ancestors and descendants only", async () => {
        vi.mocked(DbCourses.get).mockResolvedValue([
            { id: "root", name: "מחזור", parentId: null },
            { id: "mid", name: "ניצה", parentId: "root" },
            { id: "leaf", name: "ניצה 1", parentId: "mid" },
            { id: "sibling", name: "לחם", parentId: "root" },
        ] as never);
        vi.mocked(DbEvent.getInRange).mockResolvedValue([
            baseEvent({ courses: ["mid"] }),
        ] as never);

        const [event] = resolveStudentSchedule(
            await buildStudentSchedule("2026-03-04", CONTROLLER),
        ).events;

        expect(event.courses).toEqual(["ניצה"]);
        expect(event.relatedCourses.sort()).toEqual(
            ["מחזור", "ניצה", "ניצה 1"].sort(),
        );
    });

    it("asks the database only for the requested day, with hidden excluded", async () => {
        await buildStudentSchedule("2026-03-04", CONTROLLER);

        const [start, end, , filter] = vi.mocked(DbEvent.getInRange).mock
            .calls[0];
        expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
        expect(filter).toMatchObject({ hidden: { $ne: true } });
    });

    it("reaches Hive with the service account, never the caller's token", async () => {
        await buildStudentSchedule("2026-03-04", CONTROLLER);

        // The only Hive client used on this path. A caller-scoped client here
        // would let a student reach Hive through Bluz.
        expect(createHiveServiceClient).toHaveBeenCalled();
    });
});
