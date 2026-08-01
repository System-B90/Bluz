import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import {
    calendarReducer,
    isStaleUpsert,
} from "@/components/schedule/calendar/calendar-provider/hooks/UseEventState";
import { EventType } from "@/components/schedule/types/event";
import type { Event } from "@/components/schedule/types/event";

function makeEvent(overrides: Partial<Event> = {}): Event {
    return {
        id: "evt-001",
        name: "Test Event",
        subject: 1,
        hiveModule: 1,
        startTime: dayjs("2026-06-28T09:00:00"),
        endTime: dayjs("2026-06-28T10:00:00"),
        type: EventType.LECTURE,
        courses: [],
        rooms: [],
        instructors: [],
        lecturers: [],
        tags: [],
        notes: "",
        locked: false,
        hidden: false,
        required: false,
        personalTalk: false,
        splitAcrossBreaks: false,
        ...overrides,
    };
}

describe("isStaleUpsert (#156)", () => {
    it("treats an older revision as stale", () => {
        const existing = makeEvent({ updatedAt: 200 });
        const incoming = makeEvent({ updatedAt: 100 });
        expect(isStaleUpsert(existing, incoming)).toBe(true);
    });

    it("treats an equal revision (self-echo) as stale", () => {
        const existing = makeEvent({ updatedAt: 200 });
        const incoming = makeEvent({ updatedAt: 200, name: "Echoed" });
        expect(isStaleUpsert(existing, incoming)).toBe(true);
    });

    it("applies a strictly-newer revision", () => {
        const existing = makeEvent({ updatedAt: 200 });
        const incoming = makeEvent({ updatedAt: 201 });
        expect(isStaleUpsert(existing, incoming)).toBe(false);
    });

    it("always overwrites when revisions are missing (legacy)", () => {
        expect(isStaleUpsert(makeEvent(), makeEvent())).toBe(false);
        expect(
            isStaleUpsert(makeEvent({ updatedAt: 5 }), makeEvent()),
        ).toBe(false);
    });
});

describe("calendarReducer UPSERT guard (#156)", () => {
    it("does not overwrite newer local state with a stale broadcast", () => {
        const local = makeEvent({ name: "Newer local", updatedAt: 500 });
        const staleBroadcast = makeEvent({ name: "Stale", updatedAt: 100 });

        const state = [local];
        const next = calendarReducer(state, {
            type: "UPSERT_EVENT",
            payload: staleBroadcast,
        });

        // Same reference back -> treated as a no-op by the history reducer.
        expect(next).toBe(state);
        expect(next[0].name).toBe("Newer local");
    });

    it("returns the identical array reference for a self-echo (no flicker)", () => {
        const state = [makeEvent({ updatedAt: 500 })];
        const echo = makeEvent({ updatedAt: 500 });
        const next = calendarReducer(state, {
            type: "UPSERT_EVENT",
            payload: echo,
        });
        expect(next).toBe(state);
    });

    it("applies a strictly-newer update", () => {
        const state = [makeEvent({ name: "old", updatedAt: 100 })];
        const next = calendarReducer(state, {
            type: "UPSERT_EVENT",
            payload: makeEvent({ name: "new", updatedAt: 101 }),
        });
        expect(next[0].name).toBe("new");
    });

    it("appends genuinely new events", () => {
        const state = [makeEvent({ id: "a", updatedAt: 1 })];
        const next = calendarReducer(state, {
            type: "UPSERT_EVENT",
            payload: makeEvent({ id: "b", updatedAt: 1 }),
        });
        expect(next.map((e) => e.id)).toEqual(["a", "b"]);
    });

    it("UPSERT_MANY skips stale items but applies newer ones", () => {
        const state = [
            makeEvent({ id: "a", name: "a-old", updatedAt: 100 }),
            makeEvent({ id: "b", name: "b-new", updatedAt: 500 }),
        ];
        const next = calendarReducer(state, {
            type: "UPSERT_MANY",
            payload: [
                makeEvent({ id: "a", name: "a-newer", updatedAt: 200 }),
                makeEvent({ id: "b", name: "b-stale", updatedAt: 100 }),
                makeEvent({ id: "c", name: "c-added", updatedAt: 1 }),
            ],
        });
        const byId = Object.fromEntries(next.map((e) => [e.id, e.name]));
        expect(byId.a).toBe("a-newer");
        expect(byId.b).toBe("b-new");
        expect(byId.c).toBe("c-added");
    });

    it("UPSERT_MANY returns identical reference when nothing changes", () => {
        const state = [makeEvent({ id: "a", updatedAt: 500 })];
        const next = calendarReducer(state, {
            type: "UPSERT_MANY",
            payload: [makeEvent({ id: "a", updatedAt: 100 })],
        });
        expect(next).toBe(state);
    });
});
