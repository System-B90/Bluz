import { beforeEach, describe, expect, it, vi } from "vitest";

import { venueDate } from "./helpers/venue-time";

/**
 * Integration-level tests for the execution read path (#120): real planner +
 * real join, mocked DB boundaries. Verifies the endpoint semantics — not-cut
 * short-circuits, archived inclusion, drift detection against the recomputed
 * plan, and resilience to a gantt edited after the cut.
 */

const findToArray = vi.fn(async () => [] as Array<unknown>);
const fakeEvents = { find: vi.fn(() => ({ toArray: findToArray })) };
const fakeController = { dbName: "bluz_exec", events: fakeEvents };

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
vi.mock("@/api-server/mongo-db-controller", () => ({
    getDatabaseController: vi.fn(() => fakeController),
}));

import { DbIterations } from "@/api-server/db-iterations";
import { DbSettings } from "@/api-server/db-settings";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import { getModuleDayMappingsForCurriculum } from "@/api-server/gantt/db-mappings";
import { getCurriculumExecution } from "@/api-server/gantt/execution";
import { DbEventDocument } from "@/api-shared/types/event";
import {
    ApiCurriculum,
    ApiModuleEvent,
} from "@/api-shared/types/gantt/api-layer";
import { ScheduleSettings } from "@/api-shared/types/settings/schedule";
import { Iteration } from "@/api-shared/types/iteration";
import {
    EventRecurrence,
    GanttDayIndex,
    ModuleEventType,
} from "@/api-shared/types/gantt/models";

// ---- Fixtures (mirrors gantt-cut-integration.test.ts) -----------------------

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
        cEC: [
            {
                eventId: overrides.id,
                curriculumId: "c1",
                allocatedDuration: 60,
            },
        ],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        ...overrides,
    } as ApiModuleEvent;
}

function makeCurriculum(events: Array<ApiModuleEvent>): ApiCurriculum {
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
        startDate: "2024-01-07",
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
    } as unknown as ApiCurriculum;
}

/** A schedule event as the cut would have created it (08:00 + 60m venue time). */
function cutDoc(over: Partial<DbEventDocument> = {}): DbEventDocument {
    const date = (over.ganttOccurrenceDate as string) ?? "2024-01-07";
    return {
        id: `sched-${date}`,
        name: "e1",
        startTime: venueDate(`${date}T08:00`),
        endTime: venueDate(`${date}T09:00`),
        instructors: [],
        ganttEventId: "e1",
        ganttOccurrenceDate: date,
        ...over,
    } as DbEventDocument;
}

beforeEach(() => {
    vi.clearAllMocks();
    findToArray.mockResolvedValue([]);
    vi.mocked(DbSettings.get).mockResolvedValue({
        dayStartTime: "08:00",
    } as ScheduleSettings);
    vi.mocked(DbIterations.getByCurriculum).mockResolvedValue({
        id: "2026a",
        dbName: "bluz_exec",
        isCurrent: true,
    } as Iteration);
    vi.mocked(DbCurriculum.getItem).mockResolvedValue(
        makeCurriculum([makeEvent({ id: "e1" })]),
    );
    vi.mocked(getModuleDayMappingsForCurriculum).mockResolvedValue([
        { eventId: "e1", dayId: "w0d0", sortOrder: 0 },
    ]);
});

describe("getCurriculumExecution — short circuits", () => {
    it("returns empty events when no iteration is linked", async () => {
        vi.mocked(DbIterations.getByCurriculum).mockResolvedValue(null);
        expect(await getCurriculumExecution("c1")).toEqual({ events: {} });
        expect(DbCurriculum.getItem).not.toHaveBeenCalled();
    });

    it("returns empty events when the curriculum was never cut", async () => {
        findToArray.mockResolvedValue([]);
        expect(await getCurriculumExecution("c1")).toEqual({ events: {} });
        // Not cut ⇒ no need to load the plan at all.
        expect(DbCurriculum.getItem).not.toHaveBeenCalled();
    });

    it("queries cut events including archived ones", async () => {
        findToArray.mockResolvedValue([cutDoc()]);
        await getCurriculumExecution("c1");
        // Projected to just the fields the execution join consumes (#538 item 8).
        expect(fakeEvents.find).toHaveBeenCalledWith(
            { ganttEventId: { $exists: true } },
            {
                projection: {
                    id: 1,
                    name: 1,
                    startTime: 1,
                    endTime: 1,
                    instructors: 1,
                    archived: 1,
                    ganttEventId: 1,
                    ganttOccurrenceDate: 1,
                    _id: 0,
                },
            },
        );
    });
});

describe("getCurriculumExecution — drift detection", () => {
    it("reports no drift when the schedule matches the recomputed plan", async () => {
        findToArray.mockResolvedValue([cutDoc()]);
        const result = await getCurriculumExecution("c1");
        const execution = result.events.e1;
        expect(execution).toBeDefined();
        expect(execution.drifted).toBe(false);
        expect(execution.occurrences).toHaveLength(1);
        expect(execution.occurrences[0].actual?.eventId).toBe(
            "sched-2024-01-07",
        );
    });

    it("marks a moved schedule event as drifted", async () => {
        findToArray.mockResolvedValue([
            cutDoc({
                startTime: venueDate("2024-01-07T13:00"),
                endTime: venueDate("2024-01-07T14:00"),
            }),
        ]);
        const result = await getCurriculumExecution("c1");
        expect(result.events.e1.drifted).toBe(true);
    });

    it("marks an archived schedule event as deleted (actual: null)", async () => {
        findToArray.mockResolvedValue([cutDoc({ archived: true })]);
        const result = await getCurriculumExecution("c1");
        const occ = result.events.e1.occurrences[0];
        expect(occ.actual).toBeNull();
        expect(occ.drifted).toBe(true);
        expect(result.events.e1.totals.occurrencesActual).toBe(0);
    });

    it("detects instructor drift against the gantt orchestrator", async () => {
        vi.mocked(DbCurriculum.getItem).mockResolvedValue(
            makeCurriculum([makeEvent({ id: "e1", orchestratorId: 42 })]),
        );
        findToArray.mockResolvedValue([cutDoc({ instructors: [42, 7] })]);
        const result = await getCurriculumExecution("c1");
        expect(result.events.e1.drifted).toBe(true);
    });
});

describe("getCurriculumExecution — plan divergence after the cut", () => {
    it("keeps reporting cut events when the plan no longer validates (gantt edited)", async () => {
        // Event was unmapped after the cut → planCut fails → planned side empty,
        // but the cut schedule events must still be visible as orphans.
        vi.mocked(getModuleDayMappingsForCurriculum).mockResolvedValue([]);
        findToArray.mockResolvedValue([cutDoc()]);

        const result = await getCurriculumExecution("c1");
        const execution = result.events.e1;
        expect(execution.occurrences).toHaveLength(1);
        expect(execution.occurrences[0].planned).toBeNull();
        expect(execution.occurrences[0].drifted).toBe(true);
        expect(execution.totals.occurrencesPlanned).toBe(0);
    });

    it("still plans the mapped events when one event in the curriculum is unmapped (#…)", async () => {
        // Regression: getCurriculumExecution used to call planCut without
        // `force`, so ANY single unmapped/unsatisfied event failed the whole
        // plan and blanked "משך מתוכנן" for every event in the curriculum —
        // not just the offending one. It must now skip just e2 and still plan
        // e1, like previewCurriculumCut already does.
        vi.mocked(DbCurriculum.getItem).mockResolvedValue(
            makeCurriculum([makeEvent({ id: "e1" }), makeEvent({ id: "e2" })]),
        );
        // Only e1 is mapped to a day; e2 is left unmapped.
        vi.mocked(getModuleDayMappingsForCurriculum).mockResolvedValue([
            { eventId: "e1", dayId: "w0d0", sortOrder: 0 },
        ]);
        findToArray.mockResolvedValue([
            cutDoc(),
            cutDoc({ id: "sched-e2", ganttEventId: "e2" }),
        ]);

        const result = await getCurriculumExecution("c1");

        const e1 = result.events.e1;
        expect(e1.occurrences[0].planned).not.toBeNull();
        expect(e1.drifted).toBe(false);
        expect(e1.totals.occurrencesPlanned).toBe(1);

        // e2 stays visible as a cut event, just without a planned side.
        const e2 = result.events.e2;
        expect(e2.occurrences[0].planned).toBeNull();
        expect(e2.occurrences[0].actual).not.toBeNull();
    });

    it("groups cut events under a gantt event that no longer exists", async () => {
        findToArray.mockResolvedValue([
            cutDoc({ ganttEventId: "deleted-gantt-event" }),
        ]);
        const result = await getCurriculumExecution("c1");
        const execution = result.events["deleted-gantt-event"];
        expect(execution).toBeDefined();
        expect(execution.occurrences[0].planned).toBeNull();
        expect(execution.occurrences[0].actual).not.toBeNull();
    });

    it("splits events correctly when several gantt events were cut", async () => {
        vi.mocked(DbCurriculum.getItem).mockResolvedValue(
            makeCurriculum([makeEvent({ id: "e1" }), makeEvent({ id: "e2" })]),
        );
        vi.mocked(getModuleDayMappingsForCurriculum).mockResolvedValue([
            { eventId: "e1", dayId: "w0d0", sortOrder: 0 },
            { eventId: "e2", dayId: "w0d0", sortOrder: 1 },
        ]);
        findToArray.mockResolvedValue([
            cutDoc(),
            cutDoc({
                id: "sched-e2",
                ganttEventId: "e2",
                startTime: venueDate("2024-01-07T09:00"),
                endTime: venueDate("2024-01-07T10:00"),
            }),
        ]);

        const result = await getCurriculumExecution("c1");
        expect(Object.keys(result.events).sort()).toEqual(["e1", "e2"]);
        expect(result.events.e1.drifted).toBe(false);
        // e2 is planned to stack second (09:00) and actually sits there → clean.
        expect(result.events.e2.drifted).toBe(false);
    });
});
