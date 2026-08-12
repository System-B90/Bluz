import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the tick that opens a Hive queue when an event goes live.
 *
 * This is the half of the feature nobody watches happen, so the cases that
 * matter are the ones with no user in front of them: firing exactly once per
 * occurrence, never firing for a hidden or long-past event, and leaving the
 * work re-armed when Hive refuses the call.
 */

const { fakeActivations, fakeController } = vi.hoisted(() => {
    // Minimal stand-in for the uniquely-indexed ledger collection: an upsert
    // reports upsertedCount 1 only the first time a key is seen, which is the
    // property the activator relies on for its once-only guarantee.
    const rows = new Map<string, unknown>();
    const activations = {
        deleteOne: vi.fn(async (filter: any) => {
            rows.delete(
                `${filter.eventId}|${filter.hiveClassId}|${filter.occurrenceStart}`,
            );
            return { deletedCount: 1 };
        }),
        reset: () => rows.clear(),
        rows,
        updateOne: vi.fn(async (filter: any, update: any) => {
            const key = `${filter.eventId}|${filter.hiveClassId}|${filter.occurrenceStart}`;
            if (rows.has(key)) return { modifiedCount: 0, upsertedCount: 0 };
            rows.set(key, { ...filter, ...update.$setOnInsert });
            return { modifiedCount: 0, upsertedCount: 1 };
        }),
    };

    const events: Array<unknown> = [];
    return {
        fakeActivations: activations,
        fakeController: {
            courses: {
                find: () => ({
                    toArray: async () => [
                        { color: null, id: "c-nitza", name: "ניצה" },
                        { color: null, id: "c-lechem", name: "לחם" },
                    ],
                }),
            },
            dbName: "bluz_test",
            events: {
                find: vi.fn(() => ({ toArray: async () => events })),
                setAll: (next: Array<unknown>) => {
                    events.length = 0;
                    events.push(...next);
                },
            },
            hiveLessonActivations: activations,
        },
    };
});

vi.mock("@/api-server/mongo-db-controller", () => ({
    databaseController: fakeController,
    getDatabaseController: vi.fn(() => fakeController),
}));
vi.mock("@/api-server/db-iterations", () => ({
    DbIterations: { current: vi.fn(async () => ({ dbName: "bluz_test" })) },
}));
vi.mock("@/api-server/hive/service-client", () => ({
    createHiveServiceClient: vi.fn(),
    hasHiveServiceCredentials: vi.fn(() => true),
}));

import {
    runLessonActivationTick,
    selectLiveEvents,
} from "@/api-server/hive/lesson-activation";
import { DbEventDocument, EventType } from "@/api-shared/types/event";
import { Class } from "@/api-shared/types/hive";

const NOW = new Date("2026-08-13T08:00:30.000Z");

const HIVE_CLASSES = [
    { id: 11, name: "ניצה" },
    { id: 22, name: "לחם" },
] as Array<Class>;

function makeEvent(overrides: Partial<DbEventDocument> = {}): DbEventDocument {
    return {
        courses: ["c-nitza", "c-lechem"],
        endTime: new Date("2026-08-13T10:00:00.000Z"),
        hidden: false,
        hiveLesson: 500,
        hiveModule: 7,
        hiveQueues: { "c-lechem": 200, "c-nitza": 100 },
        id: "event-1",
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

function makeHiveStub() {
    return {
        getClasses: vi.fn(async () => HIVE_CLASSES),
        setLessonForClass: vi.fn(async () => undefined),
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    fakeActivations.reset();
});

describe("selectLiveEvents", () => {
    it("takes an event that started and has not ended", () => {
        expect(selectLiveEvents([makeEvent()], NOW)).toHaveLength(1);
    });

    it("ignores an event that has not started yet", () => {
        const future = makeEvent({
            endTime: new Date("2026-08-13T12:00:00.000Z"),
            startTime: new Date("2026-08-13T11:00:00.000Z"),
        });
        expect(selectLiveEvents([future], NOW)).toHaveLength(0);
    });

    it("ignores an event that already ended", () => {
        const past = makeEvent({
            endTime: new Date("2026-08-13T07:00:00.000Z"),
            startTime: new Date("2026-08-13T06:00:00.000Z"),
        });
        expect(selectLiveEvents([past], NOW)).toHaveLength(0);
    });

    it("ignores a long-running event whose start is far behind", () => {
        // Still in progress, but starting it now would drag a class onto a
        // lesson most of which is over.
        const stale = makeEvent({
            endTime: new Date("2026-08-13T12:00:00.000Z"),
            startTime: new Date("2026-08-13T06:00:00.000Z"),
        });
        expect(selectLiveEvents([stale], NOW)).toHaveLength(0);
    });

    it("ignores hidden, archived and fake-mapped events", () => {
        expect(selectLiveEvents([makeEvent({ hidden: true })], NOW)).toHaveLength(0);
        expect(selectLiveEvents([makeEvent({ archived: true })], NOW)).toHaveLength(0);
        expect(selectLiveEvents([makeEvent({ hiveQueues: {} })], NOW)).toHaveLength(0);
        expect(selectLiveEvents([makeEvent({ hiveLesson: null })], NOW)).toHaveLength(0);
        expect(selectLiveEvents([makeEvent({ hiveModule: 0 })], NOW)).toHaveLength(0);
    });

    it("orders overlapping events so the latest start wins", () => {
        const earlier = makeEvent({
            id: "earlier",
            startTime: new Date("2026-08-13T07:55:00.000Z"),
        });
        const later = makeEvent({ id: "later" });

        expect(selectLiveEvents([later, earlier], NOW).map((e) => e.id)).toEqual([
            "earlier",
            "later",
        ]);
    });
});

describe("runLessonActivationTick", () => {
    it("assigns the lesson to every mapped student group", async () => {
        fakeController.events.setAll([makeEvent()]);
        const hive = makeHiveStub();

        const result = await runLessonActivationTick(
            NOW,
            fakeController as any,
            hive,
        );

        expect(result.activated).toBe(2);
        expect(result.failed).toBe(0);
        expect(hive.setLessonForClass.mock.calls).toEqual([
            [11, 500],
            [22, 500],
        ]);
    });

    it("does nothing on a second pass within the same occurrence", async () => {
        fakeController.events.setAll([makeEvent()]);
        const hive = makeHiveStub();

        await runLessonActivationTick(NOW, fakeController as any, hive);
        const second = await runLessonActivationTick(
            new Date(NOW.getTime() + 30_000),
            fakeController as any,
            hive,
        );

        expect(second.activated).toBe(0);
        expect(second.alreadyActive).toBe(2);
        expect(hive.setLessonForClass).toHaveBeenCalledTimes(2);
    });

    it("re-arms when the event is moved to a new time", async () => {
        fakeController.events.setAll([makeEvent()]);
        const hive = makeHiveStub();
        await runLessonActivationTick(NOW, fakeController as any, hive);

        const movedStart = new Date("2026-08-13T09:00:00.000Z");
        fakeController.events.setAll([makeEvent({ startTime: movedStart })]);
        const second = await runLessonActivationTick(
            new Date("2026-08-13T09:00:20.000Z"),
            fakeController as any,
            hive,
        );

        expect(second.activated).toBe(2);
    });

    it("leaves the claim released when Hive rejects the assignment", async () => {
        fakeController.events.setAll([makeEvent()]);
        const hive = makeHiveStub();
        hive.setLessonForClass.mockRejectedValueOnce(new Error("500 from Hive"));

        const first = await runLessonActivationTick(
            NOW,
            fakeController as any,
            hive,
        );
        expect(first.failed).toBe(1);
        expect(first.activated).toBe(1);

        // Next tick retries only the group that failed.
        hive.setLessonForClass.mockClear();
        const second = await runLessonActivationTick(
            new Date(NOW.getTime() + 30_000),
            fakeController as any,
            hive,
        );

        expect(second.activated).toBe(1);
        expect(hive.setLessonForClass).toHaveBeenCalledExactlyOnceWith(11, 500);
    });

    it("reports a Hive outage instead of throwing", async () => {
        fakeController.events.setAll([makeEvent()]);
        const hive = makeHiveStub();
        hive.getClasses.mockRejectedValueOnce(new Error("connection refused"));

        const result = await runLessonActivationTick(
            NOW,
            fakeController as any,
            hive,
        );

        expect(result.failed).toBe(1);
        expect(result.errors[0]).toContain("connection refused");
    });

    it("does nothing when no event is live", async () => {
        fakeController.events.setAll([]);
        const hive = makeHiveStub();

        const result = await runLessonActivationTick(
            NOW,
            fakeController as any,
            hive,
        );

        expect(result).toMatchObject({
            activated: 0,
            consideredEvents: 0,
            failed: 0,
        });
        expect(hive.setLessonForClass).not.toHaveBeenCalled();
    });
});
