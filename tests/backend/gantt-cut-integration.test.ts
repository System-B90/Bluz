import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration-level tests for the full cut pipeline: real planner + real
 * orchestration, with only the DB/session-server boundaries mocked. Covers
 * recurring expansion, concurrency (idempotency re-check), shuffle/course
 * resolution, stacking of the inserted documents, overlap reporting and the
 * websocket broadcast payload.
 */

// ---- DB mocks (no Mongo / Postgres needed) --------------------------------

const fakeEvents = {
    countDocuments: vi.fn(async () => 0),
    insertMany: vi.fn(async () => ({ insertedCount: 0 })),
};
const fakeController = { dbName: "bluz_cut", events: fakeEvents };
// Cut writes fire Google Calendar sync, which reads personal settings off the
// meta controller. Stub it so the sync no-ops instead of throwing.
const fakeMetaController = {
    personalSettings: { find: vi.fn(() => ({ toArray: async () => [] })) },
};

vi.mock("@/api-server/gantt/db-curriculum", () => ({
    DbCurriculum: { getItem: vi.fn() },
}));
vi.mock("@/api-server/db-iterations", () => ({
    DbIterations: { getByCurriculum: vi.fn() },
}));
vi.mock("@/api-server/gantt/db-mappings", () => ({
    getModuleDayMappingsForCurriculum: vi.fn(async () => []),
}));
vi.mock("@/api-server/gantt/db-recurrence-exceptions", () => ({
    listRecurrenceExceptionsForCurriculum: vi.fn(async () => []),
}));
vi.mock("@/api-server/db-settings", () => ({
    DbSettings: { get: vi.fn(async () => ({ dayStartTime: "08:00" })) },
}));
vi.mock("@/api-server/db-courses", () => ({
    DbCourses: { get: vi.fn(async () => []), create: vi.fn(async () => {}) },
}));
vi.mock("@/api-server/mongo-db-controller", () => ({
    getDatabaseController: vi.fn(() => fakeController),
    getMetaController: vi.fn(() => fakeMetaController),
}));
const broadcast = vi.fn();
vi.mock("@/api-server/web-socket-utils", () => ({
    SendServerRequestToSessionServer: (...args: Array<unknown>) =>
        broadcast(...args),
}));

import { DbCourses } from "@/api-server/db-courses";
import { DbIterations } from "@/api-server/db-iterations";
import { DbSettings } from "@/api-server/db-settings";
import { Iteration } from "@/api-shared/types/iteration";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import { getModuleDayMappingsForCurriculum } from "@/api-server/gantt/db-mappings";
import { listRecurrenceExceptionsForCurriculum } from "@/api-server/gantt/db-recurrence-exceptions";
import { cutCurriculumToSchedule } from "@/api-server/gantt/cut";
import { DbEventDocument, EventType } from "@/api-shared/types/event";
import { EventDataUpdateMessage } from "@/api-shared/types";
import { ApiCurriculum, ApiModuleEvent } from "@/api-shared/types/gantt/api-layer";
import {
    EventRecurrence,
    GanttDayIndex,
    ModuleEventType,
} from "@/api-shared/types/gantt/models";

// ---- Fixtures --------------------------------------------------------------

function makeEvent(
    overrides: Partial<ApiModuleEvent> & { id: string },
): ApiModuleEvent {
    return {
        id: overrides.id,
        title: overrides.id,
        type: ModuleEventType.Lecture,
        minimumDuration: 60,
        allocatedDuration: 0,
        orchestratorId: null,
        recommendedLecturerIds: [],
        systemRequirements: [],
        roomRequirement: "בחוץ",
        recurrence: EventRecurrence.None,
        isCritical: false,
        isPaWindow: false,
        comment: null,
        shuffles: [],
        hiveSubjectId: null,
        hiveModuleId: null,
        hiveLessonId: null,
        cEC: [{ eventId: overrides.id, curriculumId: "c1", allocatedDuration: 60 }],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        ...overrides,
    } as ApiModuleEvent;
}

/** Two 7-day weeks (Sun-start), one syllabus/module holding `events`. */
function makeCurriculum(
    events: Array<ApiModuleEvent>,
    overrides: Partial<ApiCurriculum> = {},
): ApiCurriculum {
    const week = (id: string, number: number) => ({
        curriculumId: "c1",
        weekId: id,
        week: {
            id,
            number,
            w2d: Array.from({ length: 7 }, (_, d) => ({
                weekId: id,
                dayId: `${id}d${d}`,
                day: { id: `${id}d${d}`, dayIndex: d as GanttDayIndex },
            })),
        },
    });

    return {
        id: "c1",
        title: "מסלול",
        isDraft: false,
        startDate: "2024-01-07", // Sunday
        c2s: [
            {
                curriculumId: "c1",
                syllabusId: "s1",
                syllabus: {
                    id: "s1",
                    title: "סילבוס א",
                    s2m: [
                        {
                            syllabusId: "s1",
                            moduleId: "m1",
                            module: {
                                id: "m1",
                                m2e: events.map((event) => ({
                                    moduleId: "m1",
                                    eventId: event.id,
                                    event,
                                })),
                            },
                        },
                    ],
                },
            },
        ],
        c2w: [week("w0", 0), week("w1", 1)],
        ...overrides,
    } as unknown as ApiCurriculum;
}

const iteration = { id: "2026a", dbName: "bluz_cut", isCurrent: true };

function arrange(args: {
    events: Array<ApiModuleEvent>;
    mappings?: Array<{ eventId: null | string; dayId: string; sortOrder: number }>;
    exceptions?: Array<{ eventId: string; dayId: string }>;
    curriculumOverrides?: Partial<ApiCurriculum>;
}) {
    vi.mocked(DbCurriculum.getItem).mockResolvedValue(
        makeCurriculum(args.events, args.curriculumOverrides),
    );
    vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(
        iteration as Iteration,
    );
    vi.mocked(getModuleDayMappingsForCurriculum).mockResolvedValue(
        (args.mappings ?? []) as Awaited<
            ReturnType<typeof getModuleDayMappingsForCurriculum>
        >,
    );
    vi.mocked(listRecurrenceExceptionsForCurriculum).mockResolvedValue(
        (args.exceptions ?? []) as Awaited<
            ReturnType<typeof listRecurrenceExceptionsForCurriculum>
        >,
    );
}

function insertedDocs(): Array<DbEventDocument> {
    expect(fakeEvents.insertMany).toHaveBeenCalledTimes(1);
    return fakeEvents.insertMany.mock.calls[0][0] as Array<DbEventDocument>;
}

beforeEach(() => {
    vi.clearAllMocks();
    fakeEvents.countDocuments.mockResolvedValue(0);
    vi.mocked(DbSettings.get).mockResolvedValue({
        dayStartTime: "08:00",
    } as Awaited<ReturnType<typeof DbSettings.get>>);
    vi.mocked(DbCourses.get).mockResolvedValue(
        [] as Awaited<ReturnType<typeof DbCourses.get>>,
    );
});

// ---- Recurring expansion ----------------------------------------------------

describe("cut — recurring expansion", () => {
    it("expands a daily event into one document per timeline day, honoring exceptions", async () => {
        arrange({
            events: [makeEvent({ id: "daily", recurrence: EventRecurrence.Daily })],
            mappings: [{ eventId: "daily", dayId: "w0d0", sortOrder: 0 }],
            exceptions: [{ eventId: "daily", dayId: "w0d3" }],
        });

        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;

        // 14 days − 1 exception = 13 documents.
        expect(outcome.result.createdEvents).toBe(13);
        const docs = insertedDocs();
        expect(docs).toHaveLength(13);

        const dates = docs.map((d) => d.ganttOccurrenceDate);
        expect(new Set(dates).size).toBe(13);
        expect(dates).not.toContain("2024-01-10"); // excepted w0d3
        expect(docs.every((d) => d.ganttEventId === "daily")).toBe(true);
    });

    it("expands a weekly event onto the same weekday of every week", async () => {
        arrange({
            events: [makeEvent({ id: "weekly", recurrence: EventRecurrence.Weekly })],
            mappings: [{ eventId: "weekly", dayId: "w0d2", sortOrder: 0 }],
        });

        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(true);
        const docs = insertedDocs();
        expect(docs.map((d) => d.ganttOccurrenceDate).sort()).toEqual([
            "2024-01-09",
            "2024-01-16",
        ]);
    });

    it("each occurrence document carries a distinct (ganttEventId, ganttOccurrenceDate) pair", async () => {
        arrange({
            events: [makeEvent({ id: "daily", recurrence: EventRecurrence.Daily })],
            mappings: [{ eventId: "daily", dayId: "w0d0", sortOrder: 0 }],
        });

        await cutCurriculumToSchedule("c1");
        const docs = insertedDocs();
        const keys = docs.map((d) => `${d.ganttEventId}|${d.ganttOccurrenceDate}`);
        expect(new Set(keys).size).toBe(docs.length);
        // Ids are unique UUIDs too.
        expect(new Set(docs.map((d) => d.id)).size).toBe(docs.length);
    });
});

// ---- Stacking of inserted documents ----------------------------------------

describe("cut — document stacking", () => {
    it("stacks same-day events sequentially by sortOrder from the configured day start", async () => {
        vi.mocked(DbSettings.get).mockResolvedValue({
            dayStartTime: "09:15",
        } as Awaited<ReturnType<typeof DbSettings.get>>);
        arrange({
            events: [
                makeEvent({ id: "first", cEC: [{ eventId: "first", curriculumId: "c1", allocatedDuration: 45 }] }),
                makeEvent({ id: "second", cEC: [{ eventId: "second", curriculumId: "c1", allocatedDuration: 90 }] }),
            ],
            mappings: [
                { eventId: "second", dayId: "w0d0", sortOrder: 5 },
                { eventId: "first", dayId: "w0d0", sortOrder: 1 },
            ],
        });

        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(true);
        const docs = insertedDocs();
        const byId = Object.fromEntries(docs.map((d) => [d.ganttEventId, d]));

        expect(byId.first.startTime.getHours()).toBe(9);
        expect(byId.first.startTime.getMinutes()).toBe(15);
        expect(byId.second.startTime.getTime()).toBe(byId.first.endTime.getTime());
        expect(outcome.ok && outcome.result.overlaps).toBe(0);
    });

    it("reports overlaps when a recurring echo collides with itself via double mapping", async () => {
        // Two mappings of the same event on the same day cannot happen via the
        // UI, but two different events with intersecting stacks can — force an
        // overlap by mapping two events whose recurrences echo onto shared days.
        arrange({
            events: [
                makeEvent({ id: "a", recurrence: EventRecurrence.Daily }),
                makeEvent({ id: "b" }),
            ],
            mappings: [
                { eventId: "a", dayId: "w0d0", sortOrder: 0 },
                { eventId: "b", dayId: "w0d1", sortOrder: 0 },
            ],
        });

        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        // Echo of `a` stacks after `b` on w0d1 → back-to-back, still 0 overlaps.
        expect(outcome.result.overlaps).toBe(0);
        expect(outcome.result.createdEvents).toBe(15); // 14 daily + 1 single
    });
});

// ---- Courses / shuffles ------------------------------------------------------

describe("cut — course resolution", () => {
    it("matches an existing course by exact name instead of creating a duplicate", async () => {
        vi.mocked(DbCourses.get).mockResolvedValue([
            { id: "existing", name: "מחלקה א", color: null },
        ] as Awaited<ReturnType<typeof DbCourses.get>>);
        arrange({
            events: [makeEvent({ id: "e1", shuffles: ["מחלקה א"] })],
            mappings: [{ eventId: "e1", dayId: "w0d0", sortOrder: 0 }],
        });

        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(DbCourses.create).not.toHaveBeenCalled();
        expect(outcome.result.createdCourses).toEqual([]);
        expect(insertedDocs()[0].courses).toEqual(["existing"]);
    });

    it("creates a shared shuffle course once even when many events reference it", async () => {
        arrange({
            events: [
                makeEvent({ id: "e1", shuffles: ["פלוגה ב"] }),
                makeEvent({ id: "e2", shuffles: ["פלוגה ב"] }),
            ],
            mappings: [
                { eventId: "e1", dayId: "w0d0", sortOrder: 0 },
                { eventId: "e2", dayId: "w0d1", sortOrder: 0 },
            ],
        });

        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(DbCourses.create).toHaveBeenCalledTimes(1);
        expect(outcome.result.createdCourses).toHaveLength(1);
        const docs = insertedDocs();
        const courseId = outcome.result.createdCourses[0].id;
        expect(docs.every((d) => d.courses.length === 1 && d.courses[0] === courseId)).toBe(true);
    });

    it("mixes matched and created courses on a multi-shuffle event", async () => {
        vi.mocked(DbCourses.get).mockResolvedValue([
            { id: "existing", name: "קיים", color: null },
        ] as Awaited<ReturnType<typeof DbCourses.get>>);
        arrange({
            events: [makeEvent({ id: "e1", shuffles: ["קיים", "חדש"] })],
            mappings: [{ eventId: "e1", dayId: "w0d0", sortOrder: 0 }],
        });

        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.result.createdCourses.map((c) => c.name)).toEqual(["חדש"]);
        const courses = insertedDocs()[0].courses;
        expect(courses).toHaveLength(2);
        expect(courses).toContain("existing");
        expect(courses).toContain(outcome.result.createdCourses[0].id);
    });
});

// ---- Concurrency / idempotency -----------------------------------------------

describe("cut — idempotency guard", () => {
    it("aborts without writing when cut events appear between gate and insert", async () => {
        arrange({
            events: [makeEvent({ id: "e1" })],
            mappings: [{ eventId: "e1", dayId: "w0d0", sortOrder: 0 }],
        });
        // First check (gate) passes; re-check right before insert finds 2.
        fakeEvents.countDocuments
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(2);

        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(false);
        if (outcome.ok) return;
        expect(outcome.error.code).toBe("already-cut");
        expect(outcome.error.count).toBe(2);
        expect(fakeEvents.insertMany).not.toHaveBeenCalled();
        expect(broadcast).not.toHaveBeenCalled();
    });
});

// ---- Broadcast ---------------------------------------------------------------

describe("cut — websocket broadcast", () => {
    it("broadcasts the inserted events keyed by id, without iterationId for the current iteration", async () => {
        arrange({
            events: [makeEvent({ id: "e1" })],
            mappings: [{ eventId: "e1", dayId: "w0d0", sortOrder: 0 }],
        });

        await cutCurriculumToSchedule("c1");
        expect(broadcast).toHaveBeenCalledTimes(1);
        const payload = broadcast.mock.calls[0][1] as EventDataUpdateMessage<DbEventDocument>;
        expect(payload.iterationId).toBeUndefined();
        const docs = insertedDocs();
        expect(Object.keys(payload.events)).toEqual([docs[0].id]);
    });

    it("tags the broadcast with the iteration id for a non-current iteration", async () => {
        arrange({
            events: [makeEvent({ id: "e1" })],
            mappings: [{ eventId: "e1", dayId: "w0d0", sortOrder: 0 }],
        });
        vi.mocked(DbIterations.getByCurriculum).mockResolvedValue({
            ...iteration,
            isCurrent: false,
        } as Iteration);

        await cutCurriculumToSchedule("c1");
        const payload = broadcast.mock.calls[0][1] as EventDataUpdateMessage<DbEventDocument>;
        expect(payload.iterationId).toBe("2026a");
    });

    it("does not broadcast when the plan yields zero occurrences", async () => {
        arrange({ events: [], mappings: [] });

        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.result.createdEvents).toBe(0);
        expect(fakeEvents.insertMany).not.toHaveBeenCalled();
        expect(broadcast).not.toHaveBeenCalled();
    });
});

// ---- Settings fallback ---------------------------------------------------------

describe("cut — day-start setting", () => {
    it("falls back to the default 08:00 when the setting is missing", async () => {
        vi.mocked(DbSettings.get).mockResolvedValue(
            null as unknown as Awaited<ReturnType<typeof DbSettings.get>>,
        );
        arrange({
            events: [makeEvent({ id: "e1" })],
            mappings: [{ eventId: "e1", dayId: "w0d0", sortOrder: 0 }],
        });

        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(true);
        const doc = insertedDocs()[0];
        expect(doc.startTime.getHours()).toBe(8);
        expect(doc.startTime.getMinutes()).toBe(0);
    });
});

// ---- Document field integrity ---------------------------------------------------

describe("cut — document field integrity", () => {
    it("every inserted document is a complete, calendar-openable event", async () => {
        arrange({
            events: [
                makeEvent({
                    id: "e1",
                    title: "אירוע מלא",
                    type: ModuleEventType.SelfTeaching,
                    orchestratorId: 12,
                    comment: "הערת גזירה",
                }),
            ],
            mappings: [{ eventId: "e1", dayId: "w0d0", sortOrder: 0 }],
        });

        await cutCurriculumToSchedule("c1");
        const doc = insertedDocs()[0];

        expect(doc.name).toBe("אירוע מלא");
        expect(doc.type).toBe(EventType.SELF_TEACHING);
        expect(doc.instructors).toEqual([12]);
        expect(doc.notes).toBe("הערת גזירה");
        expect(doc.rooms).toEqual([]);
        expect(doc.tags).toEqual([]);
        expect(doc.lecturers).toEqual([]);
        expect(doc.locked).toBe(false);
        expect(doc.hidden).toBe(false);
        expect(doc.required).toBe(false);
        expect(doc.personalTalk).toBe(false);
        expect(doc.startTime).toBeInstanceOf(Date);
        expect(doc.endTime).toBeInstanceOf(Date);
        expect(doc.endTime.getTime()).toBeGreaterThan(doc.startTime.getTime());
        expect(doc.ganttEventId).toBe("e1");
        expect(doc.ganttOccurrenceDate).toBe("2024-01-07");
    });
});
