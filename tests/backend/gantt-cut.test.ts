import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- DB mocks (no Mongo / Postgres needed) --------------------------------

const fakeEvents = {
    countDocuments: vi.fn(async () => 0),
    insertMany: vi.fn(async () => ({ insertedCount: 0 })),
    find: vi.fn(() => ({ toArray: async () => [] as Array<any> })),
    updateMany: vi.fn(async () => ({ matchedCount: 0, modifiedCount: 0 })),
};
const fakeController = {
    // The cut claims itself through this ledger's unique index (#515).
    curriculumCuts: {
        deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
        insertOne: vi.fn(async () => ({ insertedId: "claim" })),
    },
    dbName: "bluz_cut",
    events: fakeEvents,
};
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

vi.mock("@/api-server/gantt/db-constraints", () => ({
    getConstraintsForCurriculum: vi.fn(async () => []),
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
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import { getModuleDayMappingsForCurriculum } from "@/api-server/gantt/db-mappings";
import {
    buildCutPlanInput,
    buildScheduleEvent,
    countOverlappingOccurrences,
    cutCurriculumToSchedule,
    getCutStatus,
    indexCurriculumEvents,
    moduleEventTypeToCalendarType,
    pullBackCutSchedule,
} from "@/api-server/gantt/cut";
import { Course } from "@/api-shared/types/course";
import { PlannedOccurrence } from "@/api-shared/gantt/cut-planner";
import { EventType } from "@/api-shared/types/event";
import { ApiCurriculum, ApiModuleEvent } from "@/api-shared/types/gantt/api-layer";
import {
    EventRecurrence,
    GanttDayIndex,
    ModuleEventType,
} from "@/api-shared/types/gantt/models";
import { ScheduleSettings } from "@/api-shared/types/settings/schedule";
import { Iteration } from "@/api-shared/types/iteration";

const makeIteration = (overrides: Partial<Iteration> = {}): Iteration =>
    ({
        id: "2026a",
        dbName: "bluz_cut",
        isCurrent: true,
        ...overrides,
    }) as Iteration;

// ---- Fixtures --------------------------------------------------------------

function makeEvent(overrides: Partial<ApiModuleEvent> & { id: string }): ApiModuleEvent {
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
        cEC: [{ eventId: overrides.id, curriculumId: "c1", allocatedDuration: 0 }],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        ...overrides,
    } as ApiModuleEvent;
}

/** One curriculum: two weeks (Sun-start), one syllabus/module holding `events`. */
function makeCurriculum(
    events: Array<ApiModuleEvent>,
    overrides: Partial<ApiCurriculum> = {},
): ApiCurriculum {
    const week = (id: string, number: number, weekendDuty?: boolean) => ({
        curriculumId: "c1",
        weekId: id,
        week: {
            id,
            number,
            weekendDuty,
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
        c2w: [week("w1", 1), week("w0", 0)], // intentionally out of order
        ...overrides,
    } as unknown as ApiCurriculum;
}

const occ = (over: Partial<PlannedOccurrence>): PlannedOccurrence => ({
    ganttEventId: "e1",
    occurrenceDate: "2024-01-07",
    startTime: new Date("2024-01-07T08:00:00"),
    endTime: new Date("2024-01-07T09:00:00"),
    isRecurrenceEcho: false,
    ...over,
});

beforeEach(() => {
    vi.clearAllMocks();
    fakeEvents.countDocuments.mockResolvedValue(0);
    fakeEvents.find.mockReturnValue({ toArray: async () => [] as Array<any> });
    fakeEvents.updateMany.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });
    vi.mocked(DbSettings.get).mockResolvedValue({ dayStartTime: "08:00" } as ScheduleSettings);
    vi.mocked(DbCourses.get).mockResolvedValue([]);
});

// ---- Pure helpers ----------------------------------------------------------

describe("moduleEventTypeToCalendarType", () => {
    it("maps every gantt event type to its calendar counterpart", () => {
        expect(moduleEventTypeToCalendarType(ModuleEventType.Lecture)).toBe(EventType.LECTURE);
        expect(moduleEventTypeToCalendarType(ModuleEventType.Exercise)).toBe(EventType.EXERCISE);
        expect(moduleEventTypeToCalendarType(ModuleEventType.SelfTeaching)).toBe(EventType.SELF_TEACHING);
        expect(moduleEventTypeToCalendarType(ModuleEventType.Other)).toBe(EventType.OTHER);
    });
});

describe("indexCurriculumEvents", () => {
    it("indexes events by id and records the parent syllabus title", () => {
        const curriculum = makeCurriculum([makeEvent({ id: "e1" }), makeEvent({ id: "e2" })]);
        const { eventsById, syllabusTitleByEvent } = indexCurriculumEvents(curriculum);
        expect(eventsById.size).toBe(2);
        expect(eventsById.get("e1")?.title).toBe("e1");
        expect(syllabusTitleByEvent.get("e2")).toBe("סילבוס א");
    });
});

describe("buildCutPlanInput", () => {
    it("orders weeks by number, days by dayIndex, and filters module-only mappings", () => {
        const curriculum = makeCurriculum([
            makeEvent({ id: "e1", cEC: [{ eventId: "e1", curriculumId: "c1", allocatedDuration: 90 }] }),
        ]);
        const input = buildCutPlanInput({
            curriculum,
            mappings: [
                { eventId: null, dayId: "w0d0", sortOrder: 0 }, // module-only → dropped
                { eventId: "e1", dayId: "w0d0", sortOrder: 3 },
            ],
            exceptions: [{ eventId: "e1", dayId: "w1d1" }],
            dayStartTime: "09:30",
        });

        expect(input.weeks.map((w) => w.id)).toEqual(["w0", "w1"]);
        expect(input.weeks[0].dayIds).toEqual(["w0d0", "w0d1", "w0d2", "w0d3", "w0d4", "w0d5", "w0d6"]);
        expect(input.mappings).toEqual([{ eventId: "e1", dayId: "w0d0", sortOrder: 3 }]);
        expect(input.events[0].allocatedDuration).toBe(90);
        expect(input.recurrenceExceptions).toEqual([{ eventId: "e1", dayId: "w1d1" }]);
        expect(input.dayStartTime).toBe("09:30");
        expect(input.startDate).toBe("2024-01-07");
    });

    it("threads weekendDuty and weekendHomeStartTime through per week, defaulting missing weekendDuty to true", () => {
        const curriculum = makeCurriculum([makeEvent({ id: "e1" })]);
        (curriculum.c2w[0].week as { weekendDuty?: boolean }).weekendDuty = false; // "w1" (sorted second)
        // "w0" (sorted first) intentionally left unset → defaults to true.

        const input = buildCutPlanInput({
            curriculum,
            mappings: [],
            exceptions: [],
            dayStartTime: "08:00",
            weekendHomeStartTime: "10:00",
        });

        expect(input.weekendHomeStartTime).toBe("10:00");
        expect(input.weeks.find((w) => w.id === "w0")?.weekendDuty).toBe(true);
        expect(input.weeks.find((w) => w.id === "w1")?.weekendDuty).toBe(false);
    });
});

describe("countOverlappingOccurrences", () => {
    it("counts intersecting same-date pairs and ignores adjacent / different dates", () => {
        const back2back = [
            occ({ startTime: new Date("2024-01-07T08:00:00"), endTime: new Date("2024-01-07T09:00:00") }),
            occ({ startTime: new Date("2024-01-07T09:00:00"), endTime: new Date("2024-01-07T10:00:00") }),
        ];
        expect(countOverlappingOccurrences(back2back)).toBe(0);

        const overlapping = [
            occ({ startTime: new Date("2024-01-07T08:00:00"), endTime: new Date("2024-01-07T09:30:00") }),
            occ({ startTime: new Date("2024-01-07T09:00:00"), endTime: new Date("2024-01-07T10:00:00") }),
            // different date, cannot overlap the two above
            occ({ occurrenceDate: "2024-01-08", startTime: new Date("2024-01-08T08:00:00"), endTime: new Date("2024-01-08T12:00:00") }),
        ];
        expect(countOverlappingOccurrences(overlapping)).toBe(1);
    });
});

describe("buildScheduleEvent", () => {
    it("copies Hive linkage, orchestrator, notes and provenance", () => {
        const event = makeEvent({
            id: "e1",
            title: "הרצאת פתיחה",
            type: ModuleEventType.Exercise,
            orchestratorId: 42,
            comment: "הערה",
            hiveSubjectId: 5,
            hiveModuleId: 6,
            hiveLessonId: 7,
        });
        const doc = buildScheduleEvent(
            occ({ ganttEventId: "e1" }),
            event,
            ["course-1"],
            [],
            new Map(),
        );

        expect(doc.name).toBe("הרצאת פתיחה");
        expect(doc.type).toBe(EventType.EXERCISE);
        expect(doc.subject).toBe(5);
        expect(doc.hiveModule).toBe(6);
        expect(doc.hiveLesson).toBe(7);
        expect(doc.instructors).toEqual([42]);
        expect(doc.notes).toBe("הערה");
        expect(doc.courses).toEqual(["course-1"]);
        expect(doc.ganttEventId).toBe("e1");
        expect(doc.ganttOccurrenceDate).toBe("2024-01-07");
        expect(doc.locked).toBe(false);
        expect(typeof doc.id).toBe("string");
    });

    it("stores a non-Hive placeholder when linkage is absent", () => {
        const event = makeEvent({ id: "e1" });
        const doc = buildScheduleEvent(occ({}), event, [], [], new Map());
        expect(doc.subject).toBe(0);
        expect(doc.hiveModule).toBe(0);
        expect(doc.hiveLesson).toBe(null);
        expect(doc.instructors).toEqual([]);
        expect(doc.notes).toBe("");
    });

    it("falls back to the containing module's Hive link when the event has none", () => {
        const event = makeEvent({ id: "e1" });
        const doc = buildScheduleEvent(
            occ({}),
            event,
            [],
            [6],
            new Map([[6, 5]]),
        );
        expect(doc.subject).toBe(5);
        expect(doc.hiveModule).toBe(6);
        expect(doc.hiveLesson).toBe(null);
    });
});

// ---- Orchestration ---------------------------------------------------------

describe("cutCurriculumToSchedule", () => {
    it("rejects a draft curriculum without writing", async () => {
        vi.mocked(DbCurriculum.getItem).mockResolvedValue(
            makeCurriculum([makeEvent({ id: "e1" })], { isDraft: true }),
        );
        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(false);
        if (outcome.ok) return;
        expect(outcome.error.code).toBe("draft");
        expect(fakeEvents.insertMany).not.toHaveBeenCalled();
        expect(DbIterations.getByCurriculum).not.toHaveBeenCalled();
    });

    it("rejects when no iteration is linked", async () => {
        vi.mocked(DbCurriculum.getItem).mockResolvedValue(makeCurriculum([makeEvent({ id: "e1" })]));
        vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(null);
        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(false);
        if (outcome.ok) return;
        expect(outcome.error.code).toBe("no-iteration");
        expect(fakeEvents.insertMany).not.toHaveBeenCalled();
    });

    it("rejects when the iteration already holds cut events (one-shot)", async () => {
        vi.mocked(DbCurriculum.getItem).mockResolvedValue(makeCurriculum([makeEvent({ id: "e1" })]));
        vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(makeIteration());
        fakeEvents.countDocuments.mockResolvedValue(3);

        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(false);
        if (outcome.ok) return;
        expect(outcome.error.code).toBe("already-cut");
        expect(outcome.error.count).toBe(3);
        expect(fakeEvents.insertMany).not.toHaveBeenCalled();
    });

    it("propagates planner validation errors without writing", async () => {
        vi.mocked(DbCurriculum.getItem).mockResolvedValue(makeCurriculum([makeEvent({ id: "e1", title: "לא ממופה" })]));
        vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(makeIteration());
        // no mappings → unmapped-event error

        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(false);
        if (outcome.ok) return;
        expect(outcome.error.code).toBe("invalid-plan");
        expect(outcome.error.errors).toEqual([
            { type: "unmapped-event", eventId: "e1", title: "לא ממופה" },
        ]);
        expect(fakeEvents.insertMany).not.toHaveBeenCalled();
    });

    it("cuts a mapped event, inserts documents and broadcasts once", async () => {
        vi.mocked(DbCurriculum.getItem).mockResolvedValue(
            makeCurriculum([makeEvent({ id: "e1", allocatedDuration: 0, cEC: [{ eventId: "e1", curriculumId: "c1", allocatedDuration: 60 }] })]),
        );
        vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(makeIteration());
        vi.mocked(getModuleDayMappingsForCurriculum).mockResolvedValue([{ eventId: "e1", dayId: "w0d0", sortOrder: 0 }]);

        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.result.createdEvents).toBe(1);
        expect(outcome.result.overlaps).toBe(0);
        expect(fakeEvents.insertMany).toHaveBeenCalledTimes(1);
        const inserted = fakeEvents.insertMany.mock.calls[0][0] as Array<any>;
        expect(inserted).toHaveLength(1);
        expect(inserted[0].ganttEventId).toBe("e1");
        expect(broadcast).toHaveBeenCalledTimes(1);
    });

    it("creates a course per shuffle with provenance and assigns it to the event", async () => {
        vi.mocked(DbCurriculum.getItem).mockResolvedValue(
            makeCurriculum([makeEvent({ id: "e1", shuffles: ["מחלקה א"], cEC: [{ eventId: "e1", curriculumId: "c1", allocatedDuration: 60 }] })]),
        );
        vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(makeIteration());
        vi.mocked(getModuleDayMappingsForCurriculum).mockResolvedValue([{ eventId: "e1", dayId: "w0d0", sortOrder: 0 }]);
        vi.mocked(DbCourses.get).mockResolvedValue([]);

        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.result.createdCourses).toHaveLength(1);
        expect(outcome.result.createdCourses[0].name).toBe("מחלקה א");
        expect(DbCourses.create).toHaveBeenCalledTimes(1);
        const createdCourse = vi.mocked(DbCourses.create).mock.calls[0][0] as Course;
        expect(createdCourse.description).toBe('נגזר מסילבוס "סילבוס א"');
        const inserted = fakeEvents.insertMany.mock.calls[0][0] as Array<any>;
        expect(inserted[0].courses).toEqual([createdCourse.id]);
    });

    it("assigns all iteration courses to an event with no shuffles", async () => {
        vi.mocked(DbCurriculum.getItem).mockResolvedValue(
            makeCurriculum([makeEvent({ id: "e1", shuffles: [], cEC: [{ eventId: "e1", curriculumId: "c1", allocatedDuration: 60 }] })]),
        );
        vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(makeIteration());
        vi.mocked(getModuleDayMappingsForCurriculum).mockResolvedValue([{ eventId: "e1", dayId: "w0d0", sortOrder: 0 }]);
        vi.mocked(DbCourses.get).mockResolvedValue([
            { id: "course-a", name: "A", color: null },
            { id: "course-b", name: "B", color: null },
        ]);

        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(DbCourses.create).not.toHaveBeenCalled();
        const inserted = fakeEvents.insertMany.mock.calls[0][0] as Array<any>;
        expect(inserted[0].courses).toEqual(["course-a", "course-b"]);
    });
});

describe("getCutStatus", () => {
    it("reports not-cut when no iteration is linked", async () => {
        vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(null);
        expect(await getCutStatus("c1")).toEqual({ cut: false, count: 0 });
    });

    it("reports cut with the live event count", async () => {
        vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(makeIteration());
        fakeEvents.countDocuments.mockResolvedValue(5);
        expect(await getCutStatus("c1")).toEqual({ cut: true, count: 5 });
    });
});

describe("pullBackCutSchedule", () => {
    it("rejects when no iteration is linked", async () => {
        vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(null);
        const outcome = await pullBackCutSchedule("c1");
        expect(outcome.ok).toBe(false);
        if (outcome.ok) return;
        expect(outcome.error.code).toBe("no-iteration");
        expect(fakeEvents.updateMany).not.toHaveBeenCalled();
    });

    it("rejects when there are no live cut events", async () => {
        vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(makeIteration());
        fakeEvents.find.mockReturnValue({ toArray: async () => [] });
        const outcome = await pullBackCutSchedule("c1");
        expect(outcome.ok).toBe(false);
        if (outcome.ok) return;
        expect(outcome.error.code).toBe("not-cut");
        expect(fakeEvents.updateMany).not.toHaveBeenCalled();
    });

    it("archives live cut events and broadcasts one removal each", async () => {
        vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(makeIteration());
        fakeEvents.find.mockReturnValue({
            toArray: async () => [{ id: "ev1" }, { id: "ev2" }],
        });

        const outcome = await pullBackCutSchedule("c1");
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.result.removedEvents).toBe(2);
        expect(fakeEvents.updateMany).toHaveBeenCalledTimes(1);
        const [filter, update] = fakeEvents.updateMany.mock.calls[0] as Array<any>;
        expect(filter).toMatchObject({ archived: { $ne: true } });
        expect(update).toEqual({ $set: { archived: true } });
        expect(broadcast).toHaveBeenCalledTimes(2);
    });
});
