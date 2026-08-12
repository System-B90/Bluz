import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the Hive lesson mirror of a Bluz event: which rules a
 * shuffle→queue mapping produces, how a lesson Bluz owns is told apart from
 * one a Segel built by hand, and what happens when the mapping goes away.
 *
 * These cover the decisions that would silently give students the wrong
 * exercise — the rule diff and the ownership guard — without a live Hive.
 */

const { fakeController } = vi.hoisted(() => ({
    fakeController: {
        courses: {
            find: () => ({
                toArray: async () => [
                    { color: null, id: "c-nitza", name: "ניצה" },
                    { color: null, id: "c-lechem", name: "לחם" },
                    { color: null, id: "c-ghost", name: "אין-בהייב" },
                ],
            }),
        },
        dbName: "bluz_test",
        events: { updateOne: vi.fn(async () => ({ modifiedCount: 1 })) },
    },
}));

vi.mock("@/api-server/mongo-db-controller", () => ({
    databaseController: fakeController,
    getDatabaseController: vi.fn(() => fakeController),
}));
vi.mock("@/api-server/hive/session-client", () => ({
    createHiveClient: vi.fn(),
}));

import {
    buildLessonDescription,
    isLessonOwnedByEvent,
    planLessonRules,
    reconcileEventLesson,
    resolveDesiredRules,
} from "@/api-server/hive/lesson-sync";
import { DbEventDocument, EventType } from "@/api-shared/types/event";
import { Class, Lesson, LessonRule } from "@/api-shared/types/hive";

const HIVE_CLASSES = [
    { id: 11, name: "ניצה" },
    { id: 22, name: "לחם" },
] as Array<Class>;

function makeEvent(overrides: Partial<DbEventDocument> = {}): DbEventDocument {
    return {
        courses: ["c-nitza", "c-lechem"],
        endTime: new Date("2026-08-13T10:00:00.000Z"),
        hidden: false,
        hiveLesson: null,
        hiveModule: 7,
        hiveQueues: { "c-lechem": 200, "c-nitza": 100 },
        id: "11111111-2222-3333-4444-555555555555",
        instructors: [],
        lecturers: [],
        locked: false,
        name: "תרגול רשתות",
        notes: "",
        personalTalk: false,
        required: false,
        rooms: [],
        splitAcrossBreaks: false,
        startTime: new Date("2026-08-13T08:00:00.000Z"),
        subject: 3,
        tags: [],
        type: EventType.EXERCISE,
        ...overrides,
    };
}

function makeRule(overrides: Partial<LessonRule> = {}): LessonRule {
    return {
        id: 1,
        parent_rule: null,
        queue: 100,
        queue_data: null,
        student_groups: [11],
        student_groups_data: null,
        ...overrides,
    } as LessonRule;
}

/** A Hive client stub recording every write the sync performs. */
function makeHiveStub(lessons: Array<Lesson>, rules: Array<LessonRule> = []) {
    return {
        createLesson: vi.fn(async (data: any) => {
            const created = { description: data.description, id: 900, module: data.module, name: data.name } as Lesson;
            lessons.push(created);
            return created;
        }),
        createLessonRule: vi.fn(async () => makeRule()),
        deleteLesson: vi.fn(async () => undefined),
        deleteLessonRule: vi.fn(async () => undefined),
        getClasses: vi.fn(async () => HIVE_CLASSES),
        getLesson: vi.fn(async (id: number) => {
            const found = lessons.find((l) => l.id === id);
            if (!found) throw new Error("404");
            return found;
        }),
        getLessonRules: vi.fn(async () => rules),
        getLessons: vi.fn(async () => lessons),
        patchLesson: vi.fn(async () => lessons[0]),
        patchLessonRule: vi.fn(async () => makeRule()),
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("planLessonRules", () => {
    it("creates a rule for every mapped group when the lesson is empty", () => {
        const plan = planLessonRules(new Map([[11, 100], [22, 200]]), []);

        expect(plan.create).toEqual([
            { classId: 11, queueId: 100 },
            { classId: 22, queueId: 200 },
        ]);
        expect(plan.update).toEqual([]);
        expect(plan.delete).toEqual([]);
    });

    it("leaves an already-correct rule untouched", () => {
        const plan = planLessonRules(
            new Map([[11, 100]]),
            [makeRule({ id: 5, queue: 100, student_groups: [11] })],
        );

        expect(plan).toEqual({ create: [], delete: [], update: [] });
    });

    it("re-points a rule whose queue changed", () => {
        const plan = planLessonRules(
            new Map([[11, 999]]),
            [makeRule({ id: 5, queue: 100, student_groups: [11] })],
        );

        expect(plan.update).toEqual([{ classId: 11, queueId: 999, ruleId: 5 }]);
        expect(plan.create).toEqual([]);
        expect(plan.delete).toEqual([]);
    });

    it("deletes rules for groups that are no longer mapped", () => {
        const plan = planLessonRules(
            new Map([[11, 100]]),
            [
                makeRule({ id: 5, queue: 100, student_groups: [11] }),
                makeRule({ id: 6, queue: 200, student_groups: [22] }),
            ],
        );

        expect(plan.delete).toEqual([6]);
    });

    it("deletes nested and multi-group rules it cannot own", () => {
        const plan = planLessonRules(
            new Map([[11, 100]]),
            [
                makeRule({ id: 5, parent_rule: 4, student_groups: [11] }),
                makeRule({ id: 6, student_groups: [11, 22] }),
            ],
        );

        expect(plan.delete).toEqual([5, 6]);
        // The group still needs a rule of its own.
        expect(plan.create).toEqual([{ classId: 11, queueId: 100 }]);
    });

    it("collapses duplicate rules for one group down to the first", () => {
        const plan = planLessonRules(
            new Map([[11, 100]]),
            [
                makeRule({ id: 5, queue: 100, student_groups: [11] }),
                makeRule({ id: 6, queue: 100, student_groups: [11] }),
            ],
        );

        expect(plan.delete).toEqual([6]);
        expect(plan.create).toEqual([]);
    });
});

describe("resolveDesiredRules", () => {
    it("maps shuffles to Hive student groups by name", () => {
        const desired = resolveDesiredRules(
            makeEvent(),
            new Map([["c-nitza", "ניצה"], ["c-lechem", "לחם"]]),
            HIVE_CLASSES,
        );

        expect([...desired]).toEqual([[11, 100], [22, 200]]);
    });

    it("skips a shuffle with no matching Hive group instead of failing", () => {
        const desired = resolveDesiredRules(
            makeEvent({
                courses: ["c-nitza", "c-ghost"],
                hiveQueues: { "c-ghost": 300, "c-nitza": 100 },
            }),
            new Map([["c-nitza", "ניצה"], ["c-ghost", "אין-בהייב"]]),
            HIVE_CLASSES,
        );

        expect([...desired]).toEqual([[11, 100]]);
    });

    it("ignores a queue left over for a course the event no longer has", () => {
        const desired = resolveDesiredRules(
            makeEvent({
                courses: ["c-nitza"],
                hiveQueues: { "c-lechem": 200, "c-nitza": 100 },
            }),
            new Map([["c-nitza", "ניצה"], ["c-lechem", "לחם"]]),
            HIVE_CLASSES,
        );

        expect([...desired]).toEqual([[11, 100]]);
    });
});

describe("ownership", () => {
    it("tags the description with the event id", () => {
        const event = makeEvent({ notes: "הערה" });
        expect(buildLessonDescription(event)).toBe(
            `bluz-event:${event.id}\nהערה`,
        );
        expect(isLessonOwnedByEvent(buildLessonDescription(event), event.id)).toBe(
            true,
        );
    });

    it("does not claim a lesson written by a person or another event", () => {
        expect(isLessonOwnedByEvent("שיעור ידני", "e1")).toBe(false);
        expect(isLessonOwnedByEvent("bluz-event:other", "e1")).toBe(false);
        expect(isLessonOwnedByEvent(undefined, "e1")).toBe(false);
    });
});

describe("reconcileEventLesson", () => {
    it("creates the lesson and one rule per shuffle", async () => {
        const hive = makeHiveStub([]);

        const lessonId = await reconcileEventLesson(
            hive,
            makeEvent(),
            "upsert",
            fakeController as any,
        );

        expect(lessonId).toBe(900);
        expect(hive.createLesson).toHaveBeenCalledOnce();
        expect(hive.createLessonRule).toHaveBeenCalledTimes(2);
        expect(hive.createLessonRule.mock.calls.map((c: any) => c[1])).toEqual([
            { queue: 100, student_groups: [11] },
            { queue: 200, student_groups: [22] },
        ]);
    });

    it("reuses the lesson it already owns instead of creating a second one", async () => {
        const event = makeEvent();
        const owned = {
            description: buildLessonDescription(event),
            id: 500,
            module: 7,
            name: "תרגול רשתות",
        } as Lesson;
        const hive = makeHiveStub([owned]);

        // hiveLesson deliberately absent: a stale client save dropped it.
        const lessonId = await reconcileEventLesson(
            hive,
            event,
            "upsert",
            fakeController as any,
        );

        expect(lessonId).toBe(500);
        expect(hive.createLesson).not.toHaveBeenCalled();
        expect(hive.patchLesson).toHaveBeenCalledWith(500, expect.anything());
    });

    it("never renames a lesson a Segel picked by hand", async () => {
        const handMade = {
            description: "שיעור של הצוות",
            id: 400,
            module: 7,
            name: "שיעור ידני",
        } as Lesson;
        const hive = makeHiveStub([handMade]);

        const lessonId = await reconcileEventLesson(
            hive,
            makeEvent({ hiveLesson: 400 }),
            "upsert",
            fakeController as any,
        );

        expect(lessonId).toBe(400);
        expect(hive.patchLesson).not.toHaveBeenCalled();
        expect(hive.createLesson).not.toHaveBeenCalled();
        // Rules are still applied to it — that is what opens the queue.
        expect(hive.createLessonRule).toHaveBeenCalledTimes(2);
    });

    it("falls back to a suffixed name when the name is taken", async () => {
        const hive = makeHiveStub([]);
        hive.createLesson
            .mockRejectedValueOnce(new Error("Lesson name must be unique"))
            .mockResolvedValueOnce({ id: 901 } as Lesson);

        const event = makeEvent();
        const lessonId = await reconcileEventLesson(
            hive,
            event,
            "upsert",
            fakeController as any,
        );

        expect(lessonId).toBe(901);
        expect(hive.createLesson.mock.calls[1][0].name).toBe(
            `${event.name} (${event.id.slice(0, 8)})`,
        );
    });

    it("deletes its lesson when the event is deleted", async () => {
        const event = makeEvent({ hiveLesson: 500 });
        const owned = {
            description: buildLessonDescription(event),
            id: 500,
            module: 7,
            name: "תרגול רשתות",
        } as Lesson;
        const hive = makeHiveStub([owned]);

        const lessonId = await reconcileEventLesson(
            hive,
            event,
            "delete",
            fakeController as any,
        );

        expect(lessonId).toBeNull();
        expect(hive.deleteLesson).toHaveBeenCalledWith(500);
    });

    it("deletes its lesson when the queue mapping is cleared", async () => {
        const event = makeEvent({ hiveLesson: 500, hiveQueues: {} });
        const owned = {
            description: buildLessonDescription(event),
            id: 500,
            module: 7,
            name: "תרגול רשתות",
        } as Lesson;
        const hive = makeHiveStub([owned]);

        await reconcileEventLesson(hive, event, "upsert", fakeController as any);

        expect(hive.deleteLesson).toHaveBeenCalledWith(500);
    });

    it("leaves a hand-made lesson alone when the event is deleted", async () => {
        const hive = makeHiveStub([
            { description: "", id: 400, module: 7, name: "ידני" } as Lesson,
        ]);

        await reconcileEventLesson(
            hive,
            makeEvent({ hiveLesson: 400 }),
            "delete",
            fakeController as any,
        );

        expect(hive.deleteLesson).not.toHaveBeenCalled();
    });

    it("creates nothing for an archived event", async () => {
        const hive = makeHiveStub([]);

        await reconcileEventLesson(
            hive,
            makeEvent({ archived: true }),
            "upsert",
            fakeController as any,
        );

        expect(hive.createLesson).not.toHaveBeenCalled();
    });
});
