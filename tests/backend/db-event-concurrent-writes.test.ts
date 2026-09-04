import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Concurrent-write coverage for `DbEvent.set` (follow-up to the websocket-sync
 * audit, #650/#651).
 *
 * EVENT_LOCK/EVENT_UNLOCK (lock-state.ts, session-server relay) is a pure
 * client-side presence indicator: it tells other tabs "someone is editing
 * this", but nothing on the write path — `app/api/event/route.ts` ->
 * `DbEvent.set` — ever reads a lock before writing. There is no
 * save-is-rejected-because-another-session-holds-the-lock code path to test,
 * because that enforcement does not exist. What *does* exist, and what this
 * file pins down, is the actual consequence: two near-simultaneous saves to
 * the same event both succeed and the second silently clobbers the first,
 * which is exactly the "silent data loss during simultaneous edits" risk the
 * lock UI only warns about but never prevents.
 */

const { fakeController, fakeEvents, fakeHistory, store } = vi.hoisted(() => {
    const store = new Map<string, Record<string, unknown>>();
    const events = {
        findOne: vi.fn(async ({ id }: { id: string }) => store.get(id) ?? null),
        updateOne: vi.fn(async ({ id }: { id: string }, { $set }: { $set: Record<string, unknown> }) => {
            const existing = store.get(id);
            if (!existing) return { matchedCount: 0, modifiedCount: 0 };
            store.set(id, { ...existing, ...$set });
            return { matchedCount: 1, modifiedCount: 1 };
        }),
        insertOne: vi.fn(async (doc: Record<string, unknown>) => {
            store.set(doc.id as string, doc);
            return { insertedId: doc.id };
        }),
    };
    const history = {
        insertOne: vi.fn(async () => ({ insertedId: "h1" })),
    };
    return {
        fakeController: { dbName: "bluz_test", events, eventHistory: history },
        fakeEvents: events,
        fakeHistory: history,
        store,
    };
});

vi.mock("@/api-server/mongo-db-controller", () => ({
    databaseController: fakeController,
    getDatabaseController: vi.fn(() => fakeController),
}));

vi.mock("@/api-server/session-user", () => ({
    getSessionUser: vi.fn(async () => ({ displayName: "מיכאל", id: "u1" })),
}));

const sentBroadcasts: Array<{ type: string; data: unknown }> = [];
vi.mock("@/api-server/web-socket-utils", () => ({
    SendServerRequestToSessionServer: vi.fn((type: string, data: unknown) => {
        sentBroadcasts.push({ type, data });
    }),
}));

import { DbEvent } from "@/api-server/db-event";
import { DbEventDocument, EventType } from "@/api-shared/types/event";

function makeDocument(overrides: Partial<DbEventDocument> = {}): DbEventDocument {
    return {
        courses: [],
        endTime: new Date("2024-01-07T09:00:00.000Z"),
        hidden: false,
        hiveLesson: null,
        hiveModule: 0,
        id: "event-1",
        instructors: [],
        lecturers: [],
        locked: false,
        name: "שיעור",
        notes: "",
        personalTalk: false,
        required: false,
        rooms: [],
        splitAcrossBreaks: false,
        startTime: new Date("2024-01-07T08:00:00.000Z"),
        subject: 0,
        tags: [],
        type: EventType.LECTURE,
        ...overrides,
    } as DbEventDocument;
}

beforeEach(async () => {
    vi.clearAllMocks();
    sentBroadcasts.length = 0;
    store.clear();
    await fakeEvents.insertOne(makeDocument());
});

describe("DbEvent.set under concurrent edits (no server-side lock enforcement)", () => {
    it("lets a second save land even while another session's presence lock would still show as held", async () => {
        // Session A opens the event (an EVENT_LOCK is only ever broadcast to
        // *other* clients — see calendar-provider/index.tsx `lockEvent` — it
        // is never consulted here). Session B nonetheless saves successfully;
        // nothing in DbEvent.set checks who, if anyone, holds the lock.
        const saved = await DbEvent.set(
            makeDocument({ name: "עודכן על ידי B" }),
            undefined,
            fakeController as never,
        );

        expect(saved.name).toBe("עודכן על ידי B");
        expect(fakeEvents.updateOne).toHaveBeenCalledTimes(1);
    });

    it("resolves two near-simultaneous saves to the same event as last-write-wins, silently dropping the first", async () => {
        // Two sessions race to save the same event with different edits. Both
        // read the pre-race document, both writes succeed (matchedCount is
        // never 0), and whichever `updateOne` runs last determines the final
        // stored value — the other session's edit is gone with no error,
        // conflict, or merge.
        const [ resultA, resultB ] = await Promise.all([
            DbEvent.set(
                makeDocument({ name: "גרסה של א׳" }),
                undefined,
                fakeController as never,
            ),
            DbEvent.set(
                makeDocument({ name: "גרסה של ב׳" }),
                undefined,
                fakeController as never,
            ),
        ]);

        expect(resultA.name).toBe("גרסה של א׳");
        expect(resultB.name).toBe("גרסה של ב׳");

        const stored = await fakeEvents.findOne({ id: "event-1" });
        // Whichever updateOne physically ran last wins the store; both API
        // calls nonetheless reported success to their respective sessions,
        // so the loser's session has no way to know its edit was discarded.
        expect(stored?.name).toBe(resultB.name);
        expect(fakeEvents.updateOne).toHaveBeenCalledTimes(2);
        // Both writes record their history entry from the pre-race `before`
        // document, since neither read saw the other's write.
        expect(fakeHistory.insertOne).toHaveBeenCalledTimes(2);

        // Both writes also broadcast EVENT_DATA_UPDATE, so a client applying
        // the two updates in issue-order (rather than in whatever order the
        // websocket happens to deliver them) can also end up disagreeing with
        // what the database actually stored.
        expect(sentBroadcasts).toHaveLength(2);
    });
});
