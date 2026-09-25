import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The schedule response sends each course / room name once and points events
 * at it by position (#656). These tests pin that shape: no duplicated names,
 * no ids, indices that always resolve, and a client resolver that restores
 * exactly the per-event names the board used to receive.
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
import { DbSettings } from "@/api-server/db-settings";
import { createHiveServiceClient } from "@/api-server/hive/service-client";
import { buildStudentSchedule } from "@/api-server/student-view";
import { relatedCourses } from "@/api-shared/course-tree";
import { resolveStudentSchedule } from "@/api-shared/student-schedule";
import { RoomSource } from "@/api-shared/types/room";
import { ApiStudentScheduleGetResponse } from "@/api-shared/types/student-view";

const DATE = "2026-09-20";

const COURSES = [
    { id: "course-root", name: "מחזור", parentId: null },
    { id: "course-a", name: "ניצה", parentId: "course-root" },
    { id: "course-a1", name: "ניצה 1", parentId: "course-a" },
    { id: "course-b", name: "לחם", parentId: "course-root" },
    { id: "course-lone", name: "בודד", parentId: null },
];
const NAME_BY_ID = new Map(COURSES.map((c) => [c.id, c.name]));

function controller(rooms: Array<{ id: string; name: string }> = []) {
    return { rooms: { find: () => ({ toArray: async () => rooms }) } } as never;
}

let seq = 0;
function event(overrides: Record<string, unknown> = {}) {
    seq += 1;
    const start = new Date(`${DATE}T06:00:00.000Z`);
    start.setUTCMinutes(seq * 7);
    return {
        courses: [],
        endTime: new Date(start.getTime() + 45 * 60_000),
        id: `event-${seq}`,
        name: `שיעור ${seq}`,
        rooms: [],
        startTime: start,
        ...overrides,
    };
}

async function build(
    events: Array<Record<string, unknown>>,
    rooms: Array<{ id: string; name: string }> = [],
) {
    vi.mocked(DbEvent.getInRange).mockResolvedValue(events as never);
    return buildStudentSchedule(DATE, controller(rooms));
}

function assertIndicesResolve(data: ApiStudentScheduleGetResponse) {
    for (const group of data.courseGroups) {
        for (const index of group) {
            expect(Number.isInteger(index)).toBe(true);
            expect(data.courseNames[index]).toBeTypeOf("string");
        }
    }
    for (const e of data.events) {
        expect(data.courseGroups[e.courses]).toBeDefined();
        expect(data.courseGroups[e.relatedCourses]).toBeDefined();
        for (const index of e.rooms) {
            expect(data.roomNames[index]).toBeTypeOf("string");
        }
    }
}

beforeEach(() => {
    vi.clearAllMocks();
    seq = 0;
    vi.mocked(DbCourses.get).mockResolvedValue(COURSES as never);
    vi.mocked(DbCustomColors.get).mockResolvedValue([]);
    vi.mocked(DbSettings.get).mockResolvedValue(null as never);
    vi.mocked(createHiveServiceClient).mockRejectedValue(new Error("no hive"));
});

describe("buildStudentSchedule — normalized names", () => {
    it("sends every course name once, however many events use it", async () => {
        const data = await build(
            Array.from({ length: 100 }, () => event({ courses: ["course-root"] })),
        );

        expect(new Set(data.courseNames).size).toBe(data.courseNames.length);
        expect([...data.courseNames].sort()).toEqual(
            ["מחזור", "ניצה", "ניצה 1", "לחם"].sort(),
        );
    });

    it("sends every room name once, however many events use it", async () => {
        const data = await build(
            Array.from({ length: 50 }, (_, i) =>
                event({
                    rooms: [
                        { id: "r1", source: RoomSource.Custom },
                        { id: i % 2 ? "r2" : "r1", source: RoomSource.Custom },
                    ],
                }),
            ),
            [
                { id: "r1", name: "כיתה 1" },
                { id: "r2", name: "כיתה 2" },
                { id: "r3", name: "לא בשימוש" },
            ],
        );

        expect(data.roomNames).toHaveLength(2);
        expect(new Set(data.roomNames)).toEqual(new Set(["כיתה 1", "כיתה 2"]));
    });

    it("never sends a name no event references", async () => {
        const data = await build(
            [event({ courses: ["course-lone"] })],
            [{ id: "r-unused", name: "לא בשימוש" }],
        );

        expect(data.courseNames).toEqual(["בודד"]);
        expect(data.roomNames).toEqual([]);
    });

    it("shares one group between events with the same course set", async () => {
        const data = await build([
            event({ courses: ["course-a"] }),
            event({ courses: ["course-a"] }),
            event({ courses: ["course-b"] }),
        ]);
        const [x, y, z] = data.events;

        expect(x.courses).toBe(y.courses);
        expect(x.relatedCourses).toBe(y.relatedCourses);
        expect(z.courses).not.toBe(x.courses);
    });

    it("sends each distinct group once", async () => {
        const data = await build(
            Array.from({ length: 60 }, (_, i) =>
                event({ courses: [["course-a"], ["course-b"], []][i % 3] }),
            ),
        );
        const keys = data.courseGroups.map((g) => g.join(","));

        expect(new Set(keys).size).toBe(keys.length);
    });

    it("keeps each event's course order", async () => {
        const data = await build([
            event({ courses: ["course-b", "course-a"] }),
            event({ courses: ["course-a", "course-b"] }),
        ]);
        const resolved = resolveStudentSchedule(data).events;

        expect(resolved[0].courses).toEqual(["לחם", "ניצה"]);
        expect(resolved[1].courses).toEqual(["ניצה", "לחם"]);
    });

    it("drops unknown course and room ids without leaving holes", async () => {
        const data = await build(
            [
                event({
                    courses: ["ghost", "course-a", "ghost-2"],
                    rooms: [
                        { id: "nope", source: RoomSource.Custom },
                        { id: "r1", source: RoomSource.Custom },
                    ],
                }),
            ],
            [{ id: "r1", name: "כיתה 1" }],
        );
        const [resolved] = resolveStudentSchedule(data).events;

        expect(resolved.courses).toEqual(["ניצה"]);
        expect(resolved.rooms).toEqual(["כיתה 1"]);
        assertIndicesResolve(data);
    });

    it("maps an event with no courses to an empty group", async () => {
        const data = await build([event({ courses: null, rooms: null })]);
        const [resolved] = resolveStudentSchedule(data).events;

        expect(resolved.courses).toEqual([]);
        expect(resolved.relatedCourses).toEqual([]);
        expect(resolved.rooms).toEqual([]);
    });

    it("returns empty tables for an empty day", async () => {
        const data = await build([]);

        expect(data.events).toEqual([]);
        expect(data.courseNames).toEqual([]);
        expect(data.courseGroups).toEqual([]);
        expect(data.roomNames).toEqual([]);
    });

    it("never puts a course or room id on the wire", async () => {
        const data = await build(
            COURSES.map((c) =>
                event({ courses: [c.id], rooms: [{ id: "room-secret", source: RoomSource.Custom }] }),
            ),
            [{ id: "room-secret", name: "כיתה" }],
        );
        const body = JSON.stringify(data);

        for (const c of COURSES) expect(body).not.toContain(c.id);
        expect(body).not.toContain("room-secret");
    });

    it("sends indices, not names, on each event", async () => {
        const data = await build(
            [event({ courses: ["course-a"], rooms: [{ id: "r1", source: RoomSource.Custom }] })],
            [{ id: "r1", name: "כיתה 1" }],
        );
        const [e] = data.events;

        expect(e.courses).toBeTypeOf("number");
        expect(e.relatedCourses).toBeTypeOf("number");
        expect(e.rooms.every((r) => typeof r === "number")).toBe(true);
    });

    it("puts each name in the body exactly once, not once per event", async () => {
        const data = await build(
            Array.from({ length: 200 }, () =>
                event({ courses: ["course-root"], rooms: [{ id: "r1", source: RoomSource.Custom }] }),
            ),
            [{ id: "r1", name: "כיתה עם שם ארוך מאוד" }],
        );
        const body = JSON.stringify(data);
        const occurrences = (name: string) => body.split(`"${name}"`).length - 1;

        for (const name of ["מחזור", "ניצה", "ניצה 1", "לחם", "כיתה עם שם ארוך מאוד"]) {
            expect(occurrences(name), name).toBe(1);
        }
        expect(body.length).toBeLessThan(
            JSON.stringify(resolveStudentSchedule(data)).length,
        );
    });

    it("keeps events sorted by start time", async () => {
        const data = await build([
            event({ startTime: new Date(`${DATE}T10:00:00Z`), endTime: new Date(`${DATE}T11:00:00Z`) }),
            event({ startTime: new Date(`${DATE}T08:00:00Z`), endTime: new Date(`${DATE}T09:00:00Z`) }),
            event({ startTime: new Date(`${DATE}T09:00:00Z`), endTime: new Date(`${DATE}T10:00:00Z`) }),
        ]);

        const starts = data.events.map((e) => e.startTime);
        expect(starts).toEqual([...starts].sort());
    });
});

describe("buildStudentSchedule — round trip through resolveStudentSchedule", () => {
    it("restores exactly the names and related names of every event", async () => {
        const tags = [
            [],
            ["course-root"],
            ["course-a"],
            ["course-a1"],
            ["course-b"],
            ["course-lone"],
            ["course-a1", "course-b"],
            ["course-a", "course-a"],
        ];
        const events = tags.map((courses) => event({ courses }));
        const data = await build(events);
        const resolved = resolveStudentSchedule(data);

        assertIndicesResolve(data);
        for (const [i, courses] of tags.entries()) {
            const got = resolved.events.find((e) => e.id === events[i].id)!;

            expect(got.courses).toEqual(courses.map((id) => NAME_BY_ID.get(id)));
            expect([...got.relatedCourses].sort()).toEqual(
                [...relatedCourses(courses, COURSES)]
                    .map((id) => NAME_BY_ID.get(id))
                    .sort(),
            );
        }
    });

    it("drops the lookup tables and keeps the envelope", async () => {
        vi.mocked(DbSettings.get).mockResolvedValue({
            calendarDayEndTime: "20:00",
            calendarDayStartTime: "07:30",
        } as never);
        const resolved = resolveStudentSchedule(await build([event()]));

        expect(Object.keys(resolved).sort()).toEqual([
            "calendarDayEndTime",
            "calendarDayStartTime",
            "date",
            "events",
        ]);
        expect(resolved.date).toBe(DATE);
        expect(resolved.calendarDayStartTime).toBe("07:30");
    });

    it("resolves random days without loss", async () => {
        let state = 3;
        const random = () => {
            state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
            return state / 2 ** 31;
        };
        const rooms = Array.from({ length: 6 }, (_, i) => ({
            id: `r${i}`,
            name: `כיתה ${i}`,
        }));
        for (let round = 0; round < 25; round++) {
            seq = 0;
            const events = Array.from({ length: Math.floor(random() * 40) }, () =>
                event({
                    courses: COURSES.filter(() => random() < 0.3).map((c) => c.id),
                    rooms: rooms
                        .filter(() => random() < 0.3)
                        .map((r) => ({ id: r.id, source: RoomSource.Custom })),
                }),
            );
            const data = await build(events, rooms);
            const resolved = resolveStudentSchedule(data);

            assertIndicesResolve(data);
            for (const src of events) {
                const got = resolved.events.find((e) => e.id === src.id)!;
                expect(got.courses).toEqual(
                    (src.courses as Array<string>).map((id) => NAME_BY_ID.get(id)),
                );
                expect(got.rooms).toEqual(
                    (src.rooms as Array<{ id: string }>).map(
                        (r) => rooms.find((x) => x.id === r.id)!.name,
                    ),
                );
            }
        }
    });
});

describe("resolveStudentSchedule", () => {
    const wire: ApiStudentScheduleGetResponse = {
        calendarDayEndTime: "20:00",
        calendarDayStartTime: "08:00",
        courseGroups: [[0, 1], []],
        courseNames: ["א", "ב"],
        date: DATE,
        events: [
            { color: "#fff", courses: 0, endTime: "e", id: "1", name: "x", relatedCourses: 0, rooms: [0, 0] },
            { color: "#fff", courses: 0, endTime: "e", id: "2", name: "y", relatedCourses: 1, rooms: [] },
        ] as ApiStudentScheduleGetResponse["events"],
        roomNames: ["כיתה"],
    };

    it("shares one array between events of the same group", () => {
        const [a, b] = resolveStudentSchedule(wire).events;

        expect(a.courses).toBe(b.courses);
        expect(a.courses).toEqual(["א", "ב"]);
    });

    it("keeps repeated room indices", () => {
        expect(resolveStudentSchedule(wire).events[0].rooms).toEqual([
            "כיתה",
            "כיתה",
        ]);
    });

    it("does not mutate its input", () => {
        const snapshot = JSON.stringify(wire);
        resolveStudentSchedule(wire);

        expect(JSON.stringify(wire)).toBe(snapshot);
    });
});

describe("buildStudentSchedule — efficiency", () => {
    it("logs in to Hive once for both the room and subject lookups", async () => {
        const hive = {
            getRooms: vi.fn(async () => [{ id: 7, name: "חדר", display_name: "x / חדר" }]),
            getSubjects: vi.fn(async () => [{ id: 3, color: "#123456" }]),
        };
        vi.mocked(createHiveServiceClient).mockResolvedValue(hive as never);

        const data = await build([
            event({ rooms: [{ id: 7, source: RoomSource.Hive }], subject: 3 }),
        ]);

        expect(createHiveServiceClient).toHaveBeenCalledTimes(1);
        expect(hive.getRooms).toHaveBeenCalledTimes(1);
        expect(hive.getSubjects).toHaveBeenCalledTimes(1);
        expect(data.events[0].color).toBe("#123456");
    });

    it("still serves the day when the Hive login fails", async () => {
        const data = await build(
            [event({ courses: ["course-a"], rooms: [{ id: "r1", source: RoomSource.Custom }] })],
            [{ id: "r1", name: "כיתה 1" }],
        );

        expect(resolveStudentSchedule(data).events[0].rooms).toEqual(["כיתה 1"]);
    });

    it("loads courses, colours and settings without waiting for the events", async () => {
        let release!: (value: never) => void;
        vi.mocked(DbEvent.getInRange).mockReturnValue(
            new Promise((resolve) => (release = resolve)) as never,
        );

        const pending = buildStudentSchedule(DATE, controller());
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(DbCourses.get).toHaveBeenCalled();
        expect(DbCustomColors.get).toHaveBeenCalled();
        expect(DbSettings.get).toHaveBeenCalled();

        release([] as never);
        await pending;
    });

    it("reads each source once per request", async () => {
        await build(Array.from({ length: 30 }, () => event({ courses: ["course-a"] })));

        expect(DbEvent.getInRange).toHaveBeenCalledTimes(1);
        expect(DbCourses.get).toHaveBeenCalledTimes(1);
        expect(DbCustomColors.get).toHaveBeenCalledTimes(1);
        expect(DbSettings.get).toHaveBeenCalledTimes(1);
    });
});
