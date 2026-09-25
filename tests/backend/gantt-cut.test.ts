import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- DB mocks (no Mongo / Postgres needed) --------------------------------

const fakeEvents = {
    countDocuments: vi.fn(async () => 0),
    findOne: vi.fn(async () => null as any),
    insertMany: vi.fn(async () => ({ insertedCount: 0 })),
    find: vi.fn(() => ({ toArray: async () => [] as Array<any> })),
    updateMany: vi.fn(async () => ({ matchedCount: 0, modifiedCount: 0 })),
};
const fakeEventHistory = {
    insertMany: vi.fn(async () => ({ insertedCount: 0 })),
};
const fakeController = {
    // The cut claims itself through this ledger's unique index (#515).
    curriculumCuts: {
        deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
        insertOne: vi.fn(async () => ({ insertedId: "claim" })),
    },
    dbName: "bluz_cut",
    events: fakeEvents,
    eventHistory: fakeEventHistory,
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
// The cut asks Hive for the module → subject map. Mocked so these tests never
// reach the network — and, since a failure is now retried with backoff (#662),
// never sit through that backoff either.
const getModules = vi.fn(async () => [] as Array<any>);
vi.mock("@/api-server/hive/session-client", () => ({
    createHiveClient: vi.fn(async () => ({ getModules })),
}));
const broadcast = vi.fn();
vi.mock("@/api-server/web-socket-utils", () => ({
    // The student refresh ping (#656) rides the same write paths. These suites
    // do not reach it today, but a factory mock replaces the module wholesale,
    // so an unlisted export throws the moment one does.
    NotifyStudentsOfCalendarChange: vi.fn(),
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
import { lowestCommonCourse } from "@/api-shared/course-tree";
import { Course } from "@/api-shared/types/course";
import { CutPlanEventInput, PlannedOccurrence } from "@/api-shared/gantt/cut-planner";
import { EventType } from "@/api-shared/types/event";
import { ApiCurriculum, ApiModuleEvent } from "@/api-shared/types/gantt/api-layer";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models/curriculum";
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
    fakeEvents.findOne.mockResolvedValue(null);
    fakeEvents.find.mockReturnValue({ toArray: async () => [] as Array<any> });
    fakeEvents.updateMany.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });
    vi.mocked(DbSettings.get).mockResolvedValue({ dayStartTime: "08:00" } as ScheduleSettings);
    vi.mocked(DbCourses.get).mockResolvedValue([]);
    // `clearAllMocks` clears recorded calls but keeps implementations, so any
    // per-test mapping/Hive stub would otherwise leak into the tests after it.
    vi.mocked(getModuleDayMappingsForCurriculum).mockResolvedValue([]);
    getModules.mockReset();
    getModules.mockResolvedValue([]);
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
        expect(countOverlappingOccurrences(back2back, [])).toBe(0);

        const overlapping = [
            occ({ startTime: new Date("2024-01-07T08:00:00"), endTime: new Date("2024-01-07T09:30:00") }),
            occ({ startTime: new Date("2024-01-07T09:00:00"), endTime: new Date("2024-01-07T10:00:00") }),
            // different date, cannot overlap the two above
            occ({ occurrenceDate: "2024-01-08", startTime: new Date("2024-01-08T08:00:00"), endTime: new Date("2024-01-08T12:00:00") }),
        ];
        expect(countOverlappingOccurrences(overlapping, [])).toBe(1);
    });

    it("ignores shuffle-group siblings running side by side", () => {
        const side = { startTime: new Date("2024-01-07T08:00:00"), endTime: new Date("2024-01-07T09:00:00") };
        const occurrences = [
            occ({ ganttEventId: "g1", ...side }),
            occ({ ganttEventId: "g2", ...side }),
            occ({ ganttEventId: "solo", ...side }),
        ];
        const events = [
            { id: "g1", groupId: "grp" },
            { id: "g2", groupId: "grp" },
            { id: "solo", groupId: null },
        ] as Array<CutPlanEventInput>;
        // g1↔g2 skipped; solo overlaps both siblings.
        expect(countOverlappingOccurrences(occurrences, events)).toBe(2);
    });
});

describe("lowestCommonCourse", () => {
    const courses = [
        { id: "bis90", parentId: null },
        { id: "apollo", parentId: "bis90" },
        { id: "sphinx", parentId: "bis90" },
        { id: "mivtzar", parentId: "bis90" },
        { id: "other", parentId: null },
    ];

    it("returns the single assigned course", () => {
        expect(lowestCommonCourse(["apollo"], courses)).toBe("apollo");
    });

    it("returns the shared parent of sibling courses", () => {
        expect(lowestCommonCourse(["apollo", "mivtzar"], courses)).toBe("bis90");
    });

    it("returns the ancestor when a course and its parent are both assigned", () => {
        expect(lowestCommonCourse(["apollo", "bis90"], courses)).toBe("bis90");
    });

    it("returns null with no courses, unknown ids, or disjoint roots", () => {
        expect(lowestCommonCourse([], courses)).toBeNull();
        expect(lowestCommonCourse(["ghost"], courses)).toBeNull();
        expect(lowestCommonCourse(["apollo", "other"], courses)).toBeNull();
    });

    it("survives a parent cycle", () => {
        const cyclic = [
            { id: "a", parentId: "b" },
            { id: "b", parentId: "a" },
        ];
        expect(lowestCommonCourse(["a"], cyclic)).toBe("a");
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
            "curr-1" as GanttCurriculumId,
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
        expect(doc.ganttCurriculumId).toBe("curr-1");
        expect(doc.locked).toBe(false);
        expect(typeof doc.id).toBe("string");
    });

    it("stores a non-Hive placeholder when linkage is absent", () => {
        const event = makeEvent({ id: "e1" });
        const doc = buildScheduleEvent(
            occ({}),
            event,
            [],
            [],
            new Map(),
            "curr-1" as GanttCurriculumId,
        );
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
            "curr-1" as GanttCurriculumId,
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

    it("refuses when another curriculum's cut is still live in the iteration", async () => {
        // Curriculum-scoped gating must not let a second curriculum be cut on
        // top of the first's live schedule — the calendar is iteration-scoped,
        // so the two would overlay and neither pull-back could separate them.
        vi.mocked(DbCurriculum.getItem).mockResolvedValue(makeCurriculum([makeEvent({ id: "e1" })]));
        vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(makeIteration());
        // Nothing of ours; 312 of somebody else's.
        fakeEvents.countDocuments
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(312);
        fakeEvents.findOne.mockResolvedValue({ ganttCurriculumId: "c-other" });

        const outcome = await cutCurriculumToSchedule("c1");

        expect(outcome.ok).toBe(false);
        if (outcome.ok) return;
        expect(outcome.error.code).toBe("foreign-cut");
        expect(outcome.error.count).toBe(312);
        expect(outcome.error.foreignCurriculumId).toBe("c-other");
        expect(fakeEvents.insertMany).not.toHaveBeenCalled();
    });

    it("counts only this curriculum's own cut events when gating (#661)", async () => {
        // An iteration relinked from one curriculum to a duplicate holds the
        // *first* curriculum's events. Those are not this curriculum's cut and
        // used to block it with a false "already-cut".
        vi.mocked(DbCurriculum.getItem).mockResolvedValue(makeCurriculum([makeEvent({ id: "e1" })]));
        vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(makeIteration());
        vi.mocked(getModuleDayMappingsForCurriculum).mockResolvedValue([
            { dayId: "w0d0", eventId: "e1", sortOrder: 0 },
        ] as any);

        const outcome = await cutCurriculumToSchedule("c1");

        expect(outcome.ok).toBe(true);
        expect(fakeEvents.countDocuments).toHaveBeenCalledWith({
            archived: { $ne: true },
            ganttEventId: { $exists: true },
            $or: [
                { ganttCurriculumId: "c1" },
                { ganttCurriculumId: { $not: { $type: "string" } } },
            ],
        });
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

    describe("nests shuffle courses under the syllabus's lowest common course", () => {
        const hierarchy: Array<Course> = [
            { id: "bis90", name: "Bis90", color: null, parentId: null },
            { id: "apollo", name: "Apollo", color: null, parentId: "bis90" },
            { id: "sphinx", name: "Sphinx", color: null, parentId: "bis90" },
            { id: "mivtzar", name: "Mivtzar", color: null, parentId: "bis90" },
        ];

        const cutWithSyllabusCourses = async (courseIds: Array<string>) => {
            const curriculum = makeCurriculum([
                makeEvent({ id: "e1", shuffles: ["תפפ 1", "תפפ 2"], cEC: [{ eventId: "e1", curriculumId: "c1", allocatedDuration: 60 }] }),
            ]);
            (curriculum.c2s![0].syllabus as any).courseIds = courseIds;
            vi.mocked(DbCurriculum.getItem).mockResolvedValue(curriculum);
            vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(makeIteration());
            vi.mocked(getModuleDayMappingsForCurriculum).mockResolvedValue([{ eventId: "e1", dayId: "w0d0", sortOrder: 0 }]);
            vi.mocked(DbCourses.get).mockResolvedValue(hierarchy);

            const outcome = await cutCurriculumToSchedule("c1");
            expect(outcome.ok).toBe(true);
            const created = vi.mocked(DbCourses.create).mock.calls.map((call) => call[0] as Course);
            expect(created.map((c) => c.name)).toEqual(["תפפ 1", "תפפ 2"]);
            return created.map((c) => c.parentId);
        };

        it("under the one assigned course", async () => {
            expect(await cutWithSyllabusCourses(["apollo"])).toEqual(["apollo", "apollo"]);
        });

        it("under the shared parent of several assigned courses", async () => {
            expect(await cutWithSyllabusCourses(["apollo", "mivtzar"])).toEqual(["bis90", "bis90"]);
        });

        it("at top level when the syllabus has no course", async () => {
            expect(await cutWithSyllabusCourses([])).toEqual([null, null]);
        });
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

/**
 * A transient Hive failure during the cut used to be swallowed to an empty
 * module → subject map, stamping every module-linked event `subject: 0` — no
 * subject, and so no colour — with nothing but a server log line to show for
 * it (#662).
 */
describe("cut — Hive subject fallback", () => {
    /** Curriculum whose module carries the Hive link, not its event. */
    const moduleLinkedCurriculum = () => {
        const curriculum = makeCurriculum([makeEvent({ id: "e1" })]);
        (curriculum as any).c2s[0].syllabus.s2m[0].module.hiveIds = [6];
        return curriculum;
    };

    const arrange = () => {
        vi.mocked(DbCurriculum.getItem).mockResolvedValue(moduleLinkedCurriculum());
        vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(makeIteration());
        vi.mocked(getModuleDayMappingsForCurriculum).mockResolvedValue([
            { dayId: "w0d0", eventId: "e1", sortOrder: 0 },
        ] as any);
    };

    it("resolves the subject from the module's Hive link", async () => {
        arrange();
        getModules.mockResolvedValue([{ id: 6, parent_subject: 42 }]);

        const outcome = await cutCurriculumToSchedule("c1");

        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.result.hiveSubjectsUnavailable).toBe(false);
        const inserted = fakeEvents.insertMany.mock.calls[0][0] as Array<any>;
        expect(inserted[0].subject).toBe(42);
    });

    it("retries a failing Hive fetch before giving up", async () => {
        arrange();
        getModules
            .mockRejectedValueOnce(new Error("cold session"))
            .mockResolvedValue([{ id: 6, parent_subject: 42 }]);

        const outcome = await cutCurriculumToSchedule("c1");

        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(getModules).toHaveBeenCalledTimes(2);
        // The retry succeeded, so nothing was mis-tagged and nothing is warned.
        expect(outcome.result.hiveSubjectsUnavailable).toBe(false);
        const inserted = fakeEvents.insertMany.mock.calls[0][0] as Array<any>;
        expect(inserted[0].subject).toBe(42);
    });

    it("still cuts, but reports the failure, when every attempt fails", async () => {
        arrange();
        getModules.mockRejectedValue(new Error("hive down"));

        const outcome = await cutCurriculumToSchedule("c1");

        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(getModules).toHaveBeenCalledTimes(3);
        // The cut is not blocked by a Hive outage — but the caller is told the
        // events came out subject-less so it can prompt for a reload.
        expect(outcome.result.hiveSubjectsUnavailable).toBe(true);
        const inserted = fakeEvents.insertMany.mock.calls[0][0] as Array<any>;
        expect(inserted[0].subject).toBe(0);
    });

    it("does not warn when no event depended on the module fallback", async () => {
        // Event carries its own Hive subject: a Hive outage costs it nothing.
        vi.mocked(DbCurriculum.getItem).mockResolvedValue(
            makeCurriculum([makeEvent({ id: "e1", hiveSubjectId: 9, hiveModuleId: 6 })]),
        );
        vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(makeIteration());
        vi.mocked(getModuleDayMappingsForCurriculum).mockResolvedValue([
            { dayId: "w0d0", eventId: "e1", sortOrder: 0 },
        ] as any);
        getModules.mockRejectedValue(new Error("hive down"));

        const outcome = await cutCurriculumToSchedule("c1");

        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.result.hiveSubjectsUnavailable).toBe(false);
    });
});
