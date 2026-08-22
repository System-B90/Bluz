import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The cut and pull-back must leave a trail in the event change log — that log
 * is what a later reload reads to tell gantt-made events from human-edited
 * ones. A cut event with no rows would look "never touched by the gantt".
 */

const { fakeController, fakeEvents, fakeHistory } = vi.hoisted(() => {
    const events = {
        countDocuments: vi.fn(async () => 0),
        find: vi.fn(() => ({ toArray: async () => [] as Array<unknown> })),
        insertMany: vi.fn(async () => ({ insertedCount: 0 })),
        updateMany: vi.fn(async () => ({ modifiedCount: 0 })),
    };
    const history = {
        find: vi.fn(() => ({ toArray: async () => [] as Array<unknown> })),
        insertMany: vi.fn(async () => ({ insertedCount: 0 })),
        insertOne: vi.fn(async () => ({ insertedId: "x" })),
    };
    return {
        fakeController: {
            // The cut claims itself through this ledger's unique index (#515).
            curriculumCuts: {
                deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
                insertOne: vi.fn(async () => ({ insertedId: "claim" })),
            },
            dbName: "bluz_cut",
            eventHistory: history,
            events,
        },
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
    getModuleDayMappingsForCurriculum: vi.fn(async () => [
        { dayId: "w0d0", eventId: "g1", sortOrder: 0 },
    ]),
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
    DbCourses: { create: vi.fn(async () => {}), get: vi.fn(async () => []) },
}));
vi.mock("@/api-server/mongo-db-controller", () => ({
    databaseController: fakeController,
    getDatabaseController: vi.fn(() => fakeController),
    getMetaController: vi.fn(() => fakeMetaController),
}));
vi.mock("@/api-server/web-socket-utils", () => ({
    SendServerRequestToSessionServer: vi.fn(),
}));
vi.mock("@/api-server/hive/session-client", () => ({
    createHiveClient: vi.fn(async () => ({ getModules: async () => [] })),
}));
vi.mock("@/api-server/session-user", () => ({
    getSessionUser: vi.fn(async () => ({ displayName: "מיכאל", id: "7" })),
}));

import { DbIterations } from "@/api-server/db-iterations";
import {
    cutCurriculumToSchedule,
    pullBackCutSchedule,
} from "@/api-server/gantt/cut";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import {
    EventChangeAction,
    EventChangeInitiator,
    EventHistoryEntry,
} from "@/api-shared/types/event-history";
import { ApiCurriculum } from "@/api-shared/types/gantt/api-layer";
import {
    EventRecurrence,
    GanttDayIndex,
    ModuleEventType,
} from "@/api-shared/types/gantt/models";
import { Iteration } from "@/api-shared/types/iteration";

const curriculum = {
    c2s: [
        {
            curriculumId: "c1",
            syllabus: {
                id: "s1",
                s2m: [
                    {
                        module: {
                            id: "m1",
                            m2e: [
                                {
                                    event: {
                                        cEC: [
                                            {
                                                allocatedDuration: 60,
                                                curriculumId: "c1",
                                                eventId: "g1",
                                            },
                                        ],
                                        comment: null,
                                        hiveLessonId: null,
                                        hiveModuleId: null,
                                        hiveSubjectId: null,
                                        id: "g1",
                                        minimumDuration: 60,
                                        orchestratorId: null,
                                        recurrence: EventRecurrence.None,
                                        shuffles: [],
                                        splitAcrossBreaks: false,
                                        title: "שיעור",
                                        type: ModuleEventType.Lecture,
                                    },
                                    eventId: "g1",
                                    moduleId: "m1",
                                },
                            ],
                        },
                        moduleId: "m1",
                        syllabusId: "s1",
                    },
                ],
                title: "סילבוס",
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
} as unknown as ApiCurriculum;

const iteration = { dbName: "bluz_cut", id: "2026a", isCurrent: true };

function historyRows(): Array<EventHistoryEntry> {
    return fakeHistory.insertMany.mock.calls.flatMap(
        (call) => call[0] as Array<EventHistoryEntry>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    fakeEvents.countDocuments.mockResolvedValue(0);
    vi.mocked(DbCurriculum.getItem).mockResolvedValue(curriculum);
    vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(
        iteration as Iteration,
    );
});

describe("cut — change log", () => {
    it("logs one creation row per inserted event, attributed to the cut", async () => {
        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(true);

        const inserted = fakeEvents.insertMany.mock.calls[0][0] as Array<{
            id: string;
        }>;
        const rows = historyRows();

        expect(rows).toHaveLength(inserted.length);
        expect(rows.map((row) => row.eventId)).toEqual(
            inserted.map((document) => document.id),
        );
        expect(
            rows.every(
                (row) =>
                    row.action === EventChangeAction.Created &&
                    row.initiator === EventChangeInitiator.GanttCut &&
                    row.context?.curriculumId === "c1",
            ),
        ).toBe(true);
    });

    it("records the acting user on the cut rows", async () => {
        await cutCurriculumToSchedule("c1");
        expect(historyRows()[0]).toMatchObject({
            actorHiveId: 7,
            actorId: "7",
            actorName: "מיכאל",
        });
    });

    it("writes no rows when the cut is rejected", async () => {
        fakeEvents.countDocuments.mockResolvedValue(3); // already cut

        const outcome = await cutCurriculumToSchedule("c1");
        expect(outcome.ok).toBe(false);
        expect(fakeHistory.insertMany).not.toHaveBeenCalled();
    });
});

describe("pull-back — change log", () => {
    it("logs one archival row per pulled-back event", async () => {
        fakeEvents.find.mockReturnValue({
            toArray: async () => [{ id: "e1" }, { id: "e2" }],
        } as never);

        const outcome = await pullBackCutSchedule("c1");
        expect(outcome.ok).toBe(true);

        const rows = historyRows();
        expect(rows.map((row) => row.eventId)).toEqual(["e1", "e2"]);
        expect(
            rows.every(
                (row) =>
                    row.action === EventChangeAction.Archived &&
                    row.initiator === EventChangeInitiator.GanttPullBack &&
                    row.context?.curriculumId === "c1",
            ),
        ).toBe(true);
    });

    it("writes no rows when there is nothing to pull back", async () => {
        fakeEvents.find.mockReturnValue({ toArray: async () => [] } as never);

        const outcome = await pullBackCutSchedule("c1");
        expect(outcome).toMatchObject({ error: { code: "not-cut" }, ok: false });
        expect(fakeHistory.insertMany).not.toHaveBeenCalled();
    });
});
