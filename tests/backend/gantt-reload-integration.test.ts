import { beforeEach, describe, expect, it, vi } from "vitest";

import { venueDate } from "./helpers/venue-time";

/**
 * Integration-level tests for the schedule reload: real planner + real
 * orchestration, only the DB / session-server / Hive boundaries mocked.
 * Covers gating, the add/update/remove reconciliation, manual-edit precedence
 * (including per-event override), dry runs, change-log writes and broadcasts.
 */

const { fakeController, fakeEvents, fakeHistory } = vi.hoisted(() => {
    const events = {
        countDocuments: vi.fn(async () => 0),
        find: vi.fn(() => ({ toArray: async () => [] as Array<unknown> })),
        insertMany: vi.fn(async () => ({ insertedCount: 0 })),
        updateMany: vi.fn(async () => ({ modifiedCount: 0 })),
        updateOne: vi.fn(async () => ({ matchedCount: 1, modifiedCount: 1 })),
    };
    const history = {
        find: vi.fn(() => ({ toArray: async () => [] as Array<unknown> })),
        insertMany: vi.fn(async () => ({ insertedCount: 0 })),
        insertOne: vi.fn(async () => ({ insertedId: "x" })),
    };
    return {
        fakeController: { dbName: "bluz_reload", eventHistory: history, events },
        fakeEvents: events,
        fakeHistory: history,
    };
});

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
    DbCourses: { create: vi.fn(async () => {}), get: vi.fn(async () => []) },
}));
vi.mock("@/api-server/mongo-db-controller", () => ({
    databaseController: fakeController,
    getDatabaseController: vi.fn(() => fakeController),
    getMetaController: vi.fn(() => fakeMetaController),
}));
const broadcast = vi.fn();
vi.mock("@/api-server/web-socket-utils", () => ({
    SendServerRequestToSessionServer: (...args: Array<unknown>) =>
        broadcast(...args),
}));
vi.mock("@/api-server/hive/session-client", () => ({
    createHiveClient: vi.fn(async () => ({ getModules: async () => [] })),
}));
vi.mock("@/api-server/session-user", () => ({
    getSessionUser: vi.fn(async () => ({ displayName: "מיכאל", id: "7" })),
}));

import { DbCourses } from "@/api-server/db-courses";
import { DbIterations } from "@/api-server/db-iterations";
import { DbSettings } from "@/api-server/db-settings";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import { getModuleDayMappingsForCurriculum } from "@/api-server/gantt/db-mappings";
import { listRecurrenceExceptionsForCurriculum } from "@/api-server/gantt/db-recurrence-exceptions";
import { reloadCurriculumSchedule } from "@/api-server/gantt/reload";
import { DbEventDocument, EventType } from "@/api-shared/types/event";
import {
    EventChangeAction,
    EventChangeInitiator,
    EventHistoryEntry,
} from "@/api-shared/types/event-history";
import { ApiCurriculum, ApiModuleEvent } from "@/api-shared/types/gantt/api-layer";
import {
    EventRecurrence,
    GanttDayIndex,
    ModuleEventType,
} from "@/api-shared/types/gantt/models";
import { Iteration } from "@/api-shared/types/iteration";

// ---- Fixtures --------------------------------------------------------------

function makeGanttEvent(
    overrides: { id: string } & Partial<ApiModuleEvent>,
): ApiModuleEvent {
    return {
        cEC: [
            { allocatedDuration: 60, curriculumId: "c1", eventId: overrides.id },
        ],
        comment: null,
        createdAt: "2024-01-01T00:00:00.000Z",
        hiveLessonId: null,
        hiveModuleId: null,
        hiveSubjectId: null,
        id: overrides.id,
        isCritical: false,
        isPaWindow: false,
        minimumDuration: 60,
        orchestratorId: null,
        recommendedLecturerIds: [],
        recurrence: EventRecurrence.None,
        roomRequirement: "בחוץ",
        shuffles: [],
        splitAcrossBreaks: false,
        systemRequirements: [],
        title: overrides.id,
        type: ModuleEventType.Lecture,
        updatedAt: "2024-01-01T00:00:00.000Z",
        ...overrides,
    } as ApiModuleEvent;
}

/** One 7-day week (starting Sunday 2024-01-07), one syllabus/module. */
function makeCurriculum(
    events: Array<ApiModuleEvent>,
    overrides: Partial<ApiCurriculum> = {},
): ApiCurriculum {
    return {
        c2s: [
            {
                curriculumId: "c1",
                syllabus: {
                    id: "s1",
                    s2m: [
                        {
                            module: {
                                id: "m1",
                                m2e: events.map((event) => ({
                                    event,
                                    eventId: event.id,
                                    moduleId: "m1",
                                })),
                            },
                            moduleId: "m1",
                            syllabusId: "s1",
                        },
                    ],
                    title: "סילבוס א",
                },
                syllabusId: "s1",
            },
        ],
        c2w: [
            {
                curriculumId: "c1",
                week: {
                    id: "w0",
                    number: 0,
                    w2d: Array.from({ length: 7 }, (_, d) => ({
                        day: { dayIndex: d as GanttDayIndex, id: `w0d${d}` },
                        dayId: `w0d${d}`,
                        weekId: "w0",
                    })),
                },
                weekId: "w0",
            },
        ],
        id: "c1",
        isDraft: false,
        startDate: "2024-01-07",
        title: "מסלול",
        ...overrides,
    } as unknown as ApiCurriculum;
}

/**
 * A cut schedule event as it would already exist in the iteration db. Times
 * default to the planner's own output for a first-of-day occurrence: 08:00–09:00
 * on the venue clock. The planner anchors to `APP_TIMEZONE` rather than the
 * process timezone (#415), so the fixtures must too — building these with a
 * bare `new Date` made the suite pass locally and drift on a UTC CI runner.
 */
function makeCutEvent(
    overrides: { ganttEventId: string; id: string; ganttOccurrenceDate: string } & Partial<DbEventDocument>,
): DbEventDocument {
    return {
        courses: [],
        endTime: venueDate(`${overrides.ganttOccurrenceDate}T09:00`),
        hidden: false,
        hiveLesson: null,
        hiveModule: 0,
        instructors: [],
        lecturers: [],
        locked: false,
        name: overrides.ganttEventId,
        notes: "",
        personalTalk: false,
        required: false,
        rooms: [],
        splitAcrossBreaks: false,
        startTime: venueDate(`${overrides.ganttOccurrenceDate}T08:00`),
        subject: 0,
        tags: [],
        type: EventType.LECTURE,
        ...overrides,
    } as DbEventDocument;
}

const iteration = { dbName: "bluz_reload", id: "2026a", isCurrent: true };

function arrange(args: {
    actual: Array<DbEventDocument>;
    events: Array<ApiModuleEvent>;
    curriculumOverrides?: Partial<ApiCurriculum>;
    history?: Array<Partial<EventHistoryEntry>>;
    iterationValue?: null | typeof iteration;
    mappings?: Array<{ dayId: string; eventId: null | string; sortOrder: number }>;
}) {
    vi.mocked(DbCurriculum.getItem).mockResolvedValue(
        makeCurriculum(args.events, args.curriculumOverrides),
    );
    vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(
        (args.iterationValue === undefined
            ? iteration
            : args.iterationValue) as Iteration,
    );
    vi.mocked(getModuleDayMappingsForCurriculum).mockResolvedValue(
        (args.mappings ?? []) as Awaited<
            ReturnType<typeof getModuleDayMappingsForCurriculum>
        >,
    );
    vi.mocked(listRecurrenceExceptionsForCurriculum).mockResolvedValue(
        [] as Awaited<ReturnType<typeof listRecurrenceExceptionsForCurriculum>>,
    );
    fakeEvents.find.mockReturnValue({
        toArray: async () => args.actual,
    } as never);
    fakeHistory.find.mockReturnValue({
        toArray: async () => args.history ?? [],
    } as never);
}

/** History rows as the change log would hold them for a cut event. */
const cutRow = (eventId: string) => ({
    changedAt: new Date("2024-01-01T00:00:00.000Z"),
    eventId,
    initiator: EventChangeInitiator.GanttCut,
});
const manualRow = (
    eventId: string,
    initiator: EventChangeInitiator = EventChangeInitiator.DragDrop,
) => ({
    actorName: "מיכאל",
    changedAt: new Date("2024-02-01T10:00:00.000Z"),
    eventId,
    initiator,
});

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(DbSettings.get).mockResolvedValue({
        dayStartTime: "08:00",
    } as Awaited<ReturnType<typeof DbSettings.get>>);
    vi.mocked(DbCourses.get).mockResolvedValue(
        [] as Awaited<ReturnType<typeof DbCourses.get>>,
    );
    fakeEvents.updateOne.mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
    });
});

// ---- Gating ----------------------------------------------------------------

describe("reload — gating", () => {
    it("refuses a draft curriculum and writes nothing", async () => {
        arrange({
            actual: [],
            curriculumOverrides: { isDraft: true },
            events: [makeGanttEvent({ id: "g1" })],
        });

        const outcome = await reloadCurriculumSchedule("c1");
        expect(outcome).toMatchObject({ error: { code: "draft" }, ok: false });
        expect(fakeEvents.insertMany).not.toHaveBeenCalled();
        expect(fakeEvents.updateOne).not.toHaveBeenCalled();
    });

    it("refuses when no iteration is linked", async () => {
        arrange({
            actual: [],
            events: [makeGanttEvent({ id: "g1" })],
            iterationValue: null,
        });

        const outcome = await reloadCurriculumSchedule("c1");
        expect(outcome).toMatchObject({
            error: { code: "no-iteration" },
            ok: false,
        });
    });

    it("refuses when the curriculum was never cut", async () => {
        arrange({ actual: [], events: [makeGanttEvent({ id: "g1" })] });

        const outcome = await reloadCurriculumSchedule("c1");
        expect(outcome).toMatchObject({ error: { code: "not-cut" }, ok: false });
    });

    it("reports an invalid plan (unmapped event) without writing", async () => {
        arrange({
            actual: [
                makeCutEvent({
                    ganttEventId: "g1",
                    ganttOccurrenceDate: "2024-01-07",
                    id: "e1",
                }),
            ],
            events: [makeGanttEvent({ id: "g1" })],
            mappings: [],
        });

        const outcome = await reloadCurriculumSchedule("c1");
        expect(outcome).toMatchObject({
            error: { code: "invalid-plan" },
            ok: false,
        });
        expect(fakeEvents.insertMany).not.toHaveBeenCalled();
    });
});

// ---- Reconciliation --------------------------------------------------------

describe("reload — reconciliation", () => {
    it("leaves a schedule that already matches the plan untouched", async () => {
        arrange({
            actual: [
                makeCutEvent({
                    ganttEventId: "g1",
                    ganttOccurrenceDate: "2024-01-07",
                    id: "e1",
                }),
            ],
            events: [makeGanttEvent({ id: "g1" })],
            history: [cutRow("e1")],
            mappings: [{ dayId: "w0d0", eventId: "g1", sortOrder: 0 }],
        });

        const outcome = await reloadCurriculumSchedule("c1");
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.result).toMatchObject({
            addedEvents: 0,
            applied: true,
            removedEvents: 0,
            updatedEvents: 0,
        });
        expect(outcome.result.diff.unchanged).toBe(1);
        expect(fakeEvents.insertMany).not.toHaveBeenCalled();
        expect(fakeEvents.updateOne).not.toHaveBeenCalled();
        expect(fakeEvents.updateMany).not.toHaveBeenCalled();
    });

    it("inserts occurrences the gantt gained since the cut", async () => {
        arrange({
            actual: [
                makeCutEvent({
                    ganttEventId: "g1",
                    ganttOccurrenceDate: "2024-01-07",
                    id: "e1",
                }),
            ],
            events: [makeGanttEvent({ id: "g1" }), makeGanttEvent({ id: "g2" })],
            history: [cutRow("e1")],
            mappings: [
                { dayId: "w0d0", eventId: "g1", sortOrder: 0 },
                { dayId: "w0d1", eventId: "g2", sortOrder: 0 },
            ],
        });

        const outcome = await reloadCurriculumSchedule("c1");
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.result.addedEvents).toBe(1);

        const inserted = fakeEvents.insertMany.mock
            .calls[0][0] as Array<DbEventDocument>;
        expect(inserted).toHaveLength(1);
        expect(inserted[0]).toMatchObject({
            ganttEventId: "g2",
            ganttOccurrenceDate: "2024-01-08",
        });
    });

    it("retimes an occurrence the gantt moved, keeping the event id", async () => {
        arrange({
            actual: [
                makeCutEvent({
                    ganttEventId: "g1",
                    ganttOccurrenceDate: "2024-01-09",
                    id: "e1",
                    // Stale times from the previous cut.
                    endTime: new Date("2024-01-09T20:00:00.000Z"),
                    startTime: new Date("2024-01-09T19:00:00.000Z"),
                }),
            ],
            events: [makeGanttEvent({ id: "g1" })],
            history: [cutRow("e1")],
            mappings: [{ dayId: "w0d2", eventId: "g1", sortOrder: 0 }],
        });

        const outcome = await reloadCurriculumSchedule("c1");
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.result.updatedEvents).toBe(1);

        const [filter, update] = fakeEvents.updateOne.mock.calls[0];
        expect(filter).toEqual({ id: "e1" });
        expect(Object.keys((update as { $set: object }).$set)).toEqual(
            expect.arrayContaining(["startTime", "endTime", "updatedAt"]),
        );
    });

    it("only rewrites gantt-owned fields, preserving schedule-side data", async () => {
        arrange({
            actual: [
                makeCutEvent({
                    endTime: new Date("2024-01-07T20:00:00.000Z"),
                    ganttEventId: "g1",
                    ganttOccurrenceDate: "2024-01-07",
                    id: "e1",
                    locked: true,
                    rooms: [{ id: "r1", source: "hive" }],
                    startTime: new Date("2024-01-07T19:00:00.000Z"),
                    tags: [7],
                } as never),
            ],
            events: [makeGanttEvent({ id: "g1" })],
            history: [cutRow("e1")],
            mappings: [{ dayId: "w0d0", eventId: "g1", sortOrder: 0 }],
        });

        await reloadCurriculumSchedule("c1");

        const { $set } = fakeEvents.updateOne.mock.calls[0][1] as {
            $set: Record<string, unknown>;
        };
        expect($set).not.toHaveProperty("rooms");
        expect($set).not.toHaveProperty("tags");
        expect($set).not.toHaveProperty("locked");
    });

    it("archives occurrences the gantt dropped", async () => {
        arrange({
            actual: [
                makeCutEvent({
                    ganttEventId: "g1",
                    ganttOccurrenceDate: "2024-01-07",
                    id: "e1",
                }),
                makeCutEvent({
                    ganttEventId: "g2",
                    ganttOccurrenceDate: "2024-01-08",
                    id: "e2",
                }),
            ],
            // g2 is gone from the curriculum entirely.
            events: [makeGanttEvent({ id: "g1" })],
            history: [cutRow("e1"), cutRow("e2")],
            mappings: [{ dayId: "w0d0", eventId: "g1", sortOrder: 0 }],
        });

        const outcome = await reloadCurriculumSchedule("c1");
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.result.removedEvents).toBe(1);
        expect(fakeEvents.updateMany).toHaveBeenCalledWith(
            { id: { $in: ["e2"] } },
            { $set: { archived: true } },
        );
    });

    it("archives a cut event whose gantt event was deleted outright", async () => {
        arrange({
            actual: [
                makeCutEvent({
                    ganttEventId: "g1",
                    ganttOccurrenceDate: "2024-01-07",
                    id: "e1",
                }),
                // Cut from a gantt event that no longer exists in the tree.
                makeCutEvent({
                    ganttEventId: "deleted",
                    ganttOccurrenceDate: "2024-01-08",
                    id: "orphan",
                }),
            ],
            events: [makeGanttEvent({ id: "g1" })],
            history: [cutRow("e1"), cutRow("orphan")],
            mappings: [{ dayId: "w0d0", eventId: "g1", sortOrder: 0 }],
        });

        const outcome = await reloadCurriculumSchedule("c1");
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;

        expect(outcome.result.removedEvents).toBe(1);
        expect(fakeEvents.updateMany).toHaveBeenCalledWith(
            { id: { $in: ["orphan"] } },
            { $set: { archived: true } },
        );
    });

    it("scopes the read to live cut events in the iteration", async () => {
        arrange({
            actual: [
                makeCutEvent({
                    ganttEventId: "g1",
                    ganttOccurrenceDate: "2024-01-07",
                    id: "e1",
                }),
            ],
            events: [makeGanttEvent({ id: "g1" })],
            history: [cutRow("e1")],
            mappings: [{ dayId: "w0d0", eventId: "g1", sortOrder: 0 }],
        });

        await reloadCurriculumSchedule("c1");

        expect(fakeEvents.find).toHaveBeenCalledWith({
            archived: { $ne: true },
            ganttEventId: { $exists: true },
        });
    });
});

// ---- Unfinished gantt (force) ----------------------------------------------

describe("reload — unfinished gantt", () => {
    /** One mapped event plus one the user never scheduled. */
    const arrangeUnfinished = () =>
        arrange({
            actual: [
                makeCutEvent({
                    ganttEventId: "g1",
                    ganttOccurrenceDate: "2024-01-07",
                    id: "e1",
                }),
            ],
            events: [makeGanttEvent({ id: "g1" }), makeGanttEvent({ id: "g2" })],
            history: [cutRow("e1")],
            mappings: [{ dayId: "w0d0", eventId: "g1", sortOrder: 0 }],
        });

    it("refuses the reload and names the unmapped event", async () => {
        arrangeUnfinished();

        const outcome = await reloadCurriculumSchedule("c1");
        expect(outcome.ok).toBe(false);
        if (outcome.ok) return;
        expect(outcome.error.code).toBe("invalid-plan");
        expect(outcome.error.errors).toEqual([
            expect.objectContaining({ eventId: "g2", type: "unmapped-event" }),
        ]);
    });

    it("writes nothing when it refuses", async () => {
        arrangeUnfinished();

        await reloadCurriculumSchedule("c1");
        expect(fakeEvents.insertMany).not.toHaveBeenCalled();
        expect(fakeEvents.updateOne).not.toHaveBeenCalled();
        expect(fakeEvents.updateMany).not.toHaveBeenCalled();
        expect(fakeHistory.insertMany).not.toHaveBeenCalled();
    });

    it("applies the reload around the unmapped event once forced", async () => {
        arrangeUnfinished();

        const outcome = await reloadCurriculumSchedule("c1", { force: true });
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;

        // The mapped event still matches, and the unmapped one contributes no
        // occurrence — so there is nothing to add and nothing to remove.
        expect(outcome.result).toMatchObject({
            addedEvents: 0,
            applied: true,
            removedEvents: 0,
        });
        expect(outcome.result.diff.unchanged).toBe(1);
    });

    it("removes a previously cut event once its gantt event goes unmapped", async () => {
        arrange({
            actual: [
                makeCutEvent({
                    ganttEventId: "g1",
                    ganttOccurrenceDate: "2024-01-07",
                    id: "e1",
                }),
                makeCutEvent({
                    ganttEventId: "g2",
                    ganttOccurrenceDate: "2024-01-08",
                    id: "e2",
                }),
            ],
            events: [makeGanttEvent({ id: "g1" }), makeGanttEvent({ id: "g2" })],
            history: [cutRow("e1"), cutRow("e2")],
            // g2 lost its mapping since the cut.
            mappings: [{ dayId: "w0d0", eventId: "g1", sortOrder: 0 }],
        });

        const outcome = await reloadCurriculumSchedule("c1", { force: true });
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;

        // Forcing skips the event *and* drops the occurrence it used to have —
        // the consequence the dialog warns about before forcing.
        expect(outcome.result.removedEvents).toBe(1);
        expect(fakeEvents.updateMany).toHaveBeenCalledWith(
            { id: { $in: ["e2"] } },
            { $set: { archived: true } },
        );
    });
});

// ---- Manual-edit precedence ------------------------------------------------

describe("reload — manual-edit precedence", () => {
    const arrangeEditedDrift = (history: Array<Partial<EventHistoryEntry>>) =>
        arrange({
            actual: [
                makeCutEvent({
                    endTime: new Date("2024-01-07T20:00:00.000Z"),
                    ganttEventId: "g1",
                    ganttOccurrenceDate: "2024-01-07",
                    id: "e1",
                    startTime: new Date("2024-01-07T19:00:00.000Z"),
                }),
            ],
            events: [makeGanttEvent({ id: "g1" })],
            history,
            mappings: [{ dayId: "w0d0", eventId: "g1", sortOrder: 0 }],
        });

    it("skips an event edited by a human and reports it as a conflict", async () => {
        arrangeEditedDrift([cutRow("e1"), manualRow("e1")]);

        const outcome = await reloadCurriculumSchedule("c1");
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;

        expect(outcome.result.updatedEvents).toBe(0);
        expect(outcome.result.skippedConflicts).toBe(1);
        expect(fakeEvents.updateOne).not.toHaveBeenCalled();
        expect(outcome.result.diff.conflicts[0]).toMatchObject({
            eventId: "e1",
            kind: "update",
            lastManualEdit: {
                actorName: "מיכאל",
                initiator: EventChangeInitiator.DragDrop,
            },
        });
    });

    it("does not treat a previous gantt reload as a manual edit", async () => {
        arrangeEditedDrift([
            cutRow("e1"),
            {
                changedAt: new Date("2024-03-01T00:00:00.000Z"),
                eventId: "e1",
                initiator: EventChangeInitiator.GanttReload,
            },
        ]);

        const outcome = await reloadCurriculumSchedule("c1");
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.result.updatedEvents).toBe(1);
        expect(outcome.result.skippedConflicts).toBe(0);
    });

    it("overwrites a manual edit when the user overrides that event", async () => {
        arrangeEditedDrift([cutRow("e1"), manualRow("e1")]);

        const outcome = await reloadCurriculumSchedule("c1", {
            overrideEventIds: ["e1"],
        });
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;

        expect(outcome.result.updatedEvents).toBe(1);
        expect(outcome.result.skippedConflicts).toBe(0);
        expect(fakeEvents.updateOne).toHaveBeenCalledTimes(1);
    });

    it("protects a manually edited event from a gantt-driven deletion", async () => {
        arrange({
            actual: [
                makeCutEvent({
                    ganttEventId: "g2",
                    ganttOccurrenceDate: "2024-01-08",
                    id: "e2",
                }),
                makeCutEvent({
                    ganttEventId: "g1",
                    ganttOccurrenceDate: "2024-01-07",
                    id: "e1",
                }),
            ],
            events: [makeGanttEvent({ id: "g1" }), makeGanttEvent({ id: "g2" })],
            history: [
                cutRow("e1"),
                cutRow("e2"),
                manualRow("e2", EventChangeInitiator.EventDialog),
            ],
            // g2 is no longer mapped anywhere ⇒ its occurrence disappears.
            mappings: [{ dayId: "w0d0", eventId: "g1", sortOrder: 0 }],
        });

        const outcome = await reloadCurriculumSchedule("c1", { force: true });
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;

        expect(outcome.result.removedEvents).toBe(0);
        expect(fakeEvents.updateMany).not.toHaveBeenCalled();
        expect(outcome.result.diff.conflicts[0]).toMatchObject({
            eventId: "e2",
            kind: "removal",
        });
    });
});

// ---- Dry run ---------------------------------------------------------------

describe("reload — dry run", () => {
    it("returns the same diff without writing anything", async () => {
        arrange({
            actual: [
                makeCutEvent({
                    endTime: new Date("2024-01-07T20:00:00.000Z"),
                    ganttEventId: "g1",
                    ganttOccurrenceDate: "2024-01-07",
                    id: "e1",
                    startTime: new Date("2024-01-07T19:00:00.000Z"),
                }),
            ],
            events: [makeGanttEvent({ id: "g1" }), makeGanttEvent({ id: "g2" })],
            history: [cutRow("e1")],
            mappings: [
                { dayId: "w0d0", eventId: "g1", sortOrder: 0 },
                { dayId: "w0d1", eventId: "g2", sortOrder: 0 },
            ],
        });

        const outcome = await reloadCurriculumSchedule("c1", { dryRun: true });
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;

        expect(outcome.result).toMatchObject({
            addedEvents: 0,
            applied: false,
            removedEvents: 0,
            updatedEvents: 0,
        });
        expect(outcome.result.diff.additions).toHaveLength(1);
        expect(outcome.result.diff.updates).toHaveLength(1);
        expect(fakeEvents.insertMany).not.toHaveBeenCalled();
        expect(fakeEvents.updateOne).not.toHaveBeenCalled();
        expect(fakeEvents.updateMany).not.toHaveBeenCalled();
        expect(broadcast).not.toHaveBeenCalled();
    });

    it("never creates a course for a new shuffle on a dry run", async () => {
        arrange({
            actual: [
                makeCutEvent({
                    ganttEventId: "g1",
                    ganttOccurrenceDate: "2024-01-07",
                    id: "e1",
                }),
            ],
            events: [makeGanttEvent({ id: "g1", shuffles: ["מחזור א"] })],
            history: [cutRow("e1")],
            mappings: [{ dayId: "w0d0", eventId: "g1", sortOrder: 0 }],
        });

        await reloadCurriculumSchedule("c1", { dryRun: true });
        expect(DbCourses.create).not.toHaveBeenCalled();
    });
});

// ---- Change log + broadcasts -----------------------------------------------

describe("reload — change log and broadcasts", () => {
    it("logs every write it performs as a gantt-reload change", async () => {
        arrange({
            actual: [
                makeCutEvent({
                    endTime: new Date("2024-01-07T20:00:00.000Z"),
                    ganttEventId: "g1",
                    ganttOccurrenceDate: "2024-01-07",
                    id: "e1",
                    startTime: new Date("2024-01-07T19:00:00.000Z"),
                }),
                makeCutEvent({
                    ganttEventId: "g3",
                    ganttOccurrenceDate: "2024-01-12",
                    id: "e3",
                }),
            ],
            events: [
                makeGanttEvent({ id: "g1" }),
                makeGanttEvent({ id: "g2" }),
                makeGanttEvent({ id: "g3" }),
            ],
            history: [cutRow("e1"), cutRow("e3")],
            mappings: [
                { dayId: "w0d0", eventId: "g1", sortOrder: 0 },
                { dayId: "w0d1", eventId: "g2", sortOrder: 0 },
            ],
        });

        // g3 lost its mapping, so the plan needs `force` to skip it — that is
        // exactly what turns its occurrence into an archival here.
        const outcome = await reloadCurriculumSchedule("c1", { force: true });
        expect(outcome.ok).toBe(true);

        const rows = fakeHistory.insertMany.mock.calls.flatMap(
            (call) => call[0] as Array<EventHistoryEntry>,
        );
        const byAction = (action: EventChangeAction) =>
            rows.filter((row) => row.action === action);

        expect(byAction(EventChangeAction.Created)).toHaveLength(1);
        expect(byAction(EventChangeAction.Updated)).toHaveLength(1);
        expect(byAction(EventChangeAction.Archived)).toHaveLength(1);
        expect(
            rows.every(
                (row) => row.initiator === EventChangeInitiator.GanttReload,
            ),
        ).toBe(true);
        expect(rows.every((row) => row.context?.curriculumId === "c1")).toBe(
            true,
        );
        // Actor resolved from the session, in both string and numeric form.
        expect(rows[0]).toMatchObject({ actorHiveId: 7, actorId: "7" });
    });

    it("broadcasts written events and removals to connected calendars", async () => {
        arrange({
            actual: [
                makeCutEvent({
                    ganttEventId: "g2",
                    ganttOccurrenceDate: "2024-01-08",
                    id: "e2",
                }),
            ],
            events: [makeGanttEvent({ id: "g1" }), makeGanttEvent({ id: "g2" })],
            history: [cutRow("e2")],
            mappings: [{ dayId: "w0d0", eventId: "g1", sortOrder: 0 }],
        });

        await reloadCurriculumSchedule("c1", { force: true });

        const messages = broadcast.mock.calls.map((call) => call[1]);
        const removals = messages.filter(
            (message) => (message as { action?: string }).action === "removed",
        );
        expect(removals).toHaveLength(1);
        expect(removals[0]).toMatchObject({ eventId: "e2" });
        // The added occurrence went out as an upsert payload.
        const upserts = messages.filter((message) => "events" in (message as object));
        expect(upserts).toHaveLength(1);
    });
});
