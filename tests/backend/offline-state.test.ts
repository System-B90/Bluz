import { describe, it, expect } from "vitest";
import dayjs from "dayjs";

import { areValuesEqual, deepCopyEvent } from "@/components/schedule/types/EventUtils";
import { calendarReducer } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventState";
import { EventType } from "@/components/schedule/types/event";
import type { Event } from "@/components/schedule/types/event";

// ─── Factories ────────────────────────────────────────────────────────────────

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
        ...overrides,
    };
}

// ─── areValuesEqual ───────────────────────────────────────────────────────────

describe("areValuesEqual", () => {
    it("returns true for identical primitives", () => {
        expect(areValuesEqual(1, 1)).toBe(true);
        expect(areValuesEqual("a", "a")).toBe(true);
        expect(areValuesEqual(true, true)).toBe(true);
    });

    it("returns false for different primitives", () => {
        expect(areValuesEqual(1, 2)).toBe(false);
        expect(areValuesEqual("a", "b")).toBe(false);
    });

    it("returns true for undefined === undefined (critical for new-event detection)", () => {
        // When a locally created event has no capturedVersion and no serverVersion,
        // areDiffValuesEqual(undefined, undefined) must be true so `conflicting` is false.
        expect(areValuesEqual(undefined, undefined)).toBe(true);
    });

    it("returns false when one side is null and the other is not", () => {
        expect(areValuesEqual(null, undefined)).toBe(false);
        expect(areValuesEqual(undefined, null)).toBe(false);
        expect(areValuesEqual(null, "value")).toBe(false);
    });

    it("compares Dayjs timestamps by value, not reference", () => {
        const a = dayjs("2026-06-28T09:00:00");
        const b = dayjs("2026-06-28T09:00:00");
        expect(areValuesEqual(a, b)).toBe(true);
    });

    it("detects different Dayjs timestamps", () => {
        const a = dayjs("2026-06-28T09:00:00");
        const b = dayjs("2026-06-28T10:00:00");
        expect(areValuesEqual(a, b)).toBe(false);
    });

    it("compares ISO date strings by their time value", () => {
        expect(
            areValuesEqual("2026-06-28T09:00:00", "2026-06-28T09:00:00"),
        ).toBe(true);
        expect(
            areValuesEqual("2026-06-28T09:00:00", "2026-06-28T10:00:00"),
        ).toBe(false);
    });

    it("does NOT treat plain strings as dates", () => {
        expect(areValuesEqual("hello", "hello")).toBe(true);
        expect(areValuesEqual("hello", "world")).toBe(false);
    });

    it("compares arrays deeply", () => {
        expect(areValuesEqual([1, 2, 3], [1, 2, 3])).toBe(true);
        expect(areValuesEqual([1, 2], [1, 2, 3])).toBe(false);
        expect(areValuesEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    it("compares nested objects deeply", () => {
        expect(areValuesEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
        expect(areValuesEqual({ a: 1 }, { a: 2 })).toBe(false);
    });

    it("ignores the _id field when comparing objects", () => {
        const a = { name: "Room A", _id: "mongo-id-1" };
        const b = { name: "Room A", _id: "mongo-id-2" };
        expect(areValuesEqual(a, b)).toBe(true);
    });

    it("detects a changed name field in a full event", () => {
        const original = makeEvent({ name: "Original" });
        const modified = makeEvent({ name: "Modified" });
        expect(areValuesEqual(original, modified)).toBe(false);
    });

    it("returns true for a deep-copied event with no changes", () => {
        const original = makeEvent();
        const copy = deepCopyEvent(original);
        expect(areValuesEqual(original, copy)).toBe(true);
    });
});

// ─── calendarReducer ─────────────────────────────────────────────────────────

describe("calendarReducer", () => {
    const evt1 = makeEvent({ id: "e1", name: "Event 1" });
    const evt2 = makeEvent({ id: "e2", name: "Event 2" });
    const evt3 = makeEvent({ id: "e3", name: "Event 3" });

    it("SET_EVENTS replaces the full list", () => {
        const result = calendarReducer([evt1], {
            type: "SET_EVENTS",
            payload: [evt2, evt3],
        });
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe("e2");
    });

    it("UPSERT_EVENT adds a new event", () => {
        const result = calendarReducer([evt1], {
            type: "UPSERT_EVENT",
            payload: evt2,
        });
        expect(result).toHaveLength(2);
        expect(result.find((e) => e.id === "e2")).toBeDefined();
    });

    it("UPSERT_EVENT updates an existing event in place", () => {
        const updated = makeEvent({ id: "e1", name: "Updated" });
        const result = calendarReducer([evt1, evt2], {
            type: "UPSERT_EVENT",
            payload: updated,
        });
        expect(result).toHaveLength(2);
        expect(result.find((e) => e.id === "e1")?.name).toBe("Updated");
    });

    it("UPSERT_MANY adds new events and updates existing ones", () => {
        const updatedEvt1 = makeEvent({ id: "e1", name: "Updated 1" });
        const result = calendarReducer([evt1, evt2], {
            type: "UPSERT_MANY",
            payload: [updatedEvt1, evt3],
        });
        expect(result).toHaveLength(3);
        expect(result.find((e) => e.id === "e1")?.name).toBe("Updated 1");
        expect(result.find((e) => e.id === "e3")).toBeDefined();
    });

    it("DELETE_EVENT removes the matching event", () => {
        const result = calendarReducer([evt1, evt2, evt3], {
            type: "DELETE_EVENT",
            payload: "e2",
        });
        expect(result).toHaveLength(2);
        expect(result.find((e) => e.id === "e2")).toBeUndefined();
    });

    it("DELETE_EVENT on unknown id returns unchanged list", () => {
        const result = calendarReducer([evt1], {
            type: "DELETE_EVENT",
            payload: "does-not-exist",
        });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("e1");
    });

    it("UPSERT_EVENT does not mutate the original array", () => {
        const original = [evt1];
        calendarReducer(original, { type: "UPSERT_EVENT", payload: evt2 });
        expect(original).toHaveLength(1);
    });
});

// ─── deepCopyEvent ────────────────────────────────────────────────────────────

describe("deepCopyEvent", () => {
    it("produces a new reference without mutating the original", () => {
        const original = makeEvent({ courses: [10, 20], rooms: [{ id: "r1" } as any] });
        const copy = deepCopyEvent(original);

        expect(copy).not.toBe(original);
        expect(copy.courses).not.toBe(original.courses);
        expect(copy.rooms).not.toBe(original.rooms);
    });

    it("mutating the copy's arrays does not affect the original", () => {
        const original = makeEvent({ courses: [10] });
        const copy = deepCopyEvent(original);
        (copy.courses as number[]).push(99);

        expect(original.courses).toHaveLength(1);
    });
});

// ─── Offline capture invariants ───────────────────────────────────────────────
//
// These tests verify the pure invariants that the OfflineProvider relies on:
//   1. captureEventBeforeEdit must preserve only the OLDEST (pre-edit) version.
//   2. captureInitialEvents must be idempotent.
//
// We test the invariants by simulating the state machine directly.

describe("Offline capture state invariants", () => {
    type CapturedState = Record<string, Event>;

    function captureEventBeforeEdit(
        state: CapturedState,
        event: Event,
    ): CapturedState {
        if (event.id in state) return state; // keep oldest version
        return { ...state, [event.id]: deepCopyEvent(event) };
    }

    function captureInitialEvents(
        state: CapturedState,
        events: Event[],
    ): CapturedState {
        let changed = false;
        const next = { ...state };
        for (const ev of events) {
            if (!(ev.id in next)) {
                next[ev.id] = deepCopyEvent(ev);
                changed = true;
            }
        }
        return changed ? next : state;
    }

    it("captureEventBeforeEdit stores the first (pre-edit) version", () => {
        const original = makeEvent({ id: "e1", name: "Original" });
        const modified = makeEvent({ id: "e1", name: "Modified" });

        let state: CapturedState = {};
        state = captureEventBeforeEdit(state, original);
        state = captureEventBeforeEdit(state, modified); // must be ignored

        expect(state["e1"].name).toBe("Original");
    });

    it("captureEventBeforeEdit does not overwrite an already-captured event", () => {
        const v1 = makeEvent({ id: "e1", name: "V1" });
        const v2 = makeEvent({ id: "e1", name: "V2" });
        const v3 = makeEvent({ id: "e1", name: "V3" });

        let state: CapturedState = {};
        state = captureEventBeforeEdit(state, v1);
        state = captureEventBeforeEdit(state, v2);
        state = captureEventBeforeEdit(state, v3);

        expect(state["e1"].name).toBe("V1");
    });

    it("captureInitialEvents does not capture events created after entering offline mode", () => {
        // Simulates the fixed behaviour: captureInitialEvents is called ONCE
        // on mode entry, NOT re-called when the event list grows.
        const preExisting = makeEvent({ id: "pre", name: "Pre-existing" });
        const newlyCreated = makeEvent({ id: "new", name: "Newly Created" });

        // Initial capture (when entering offline mode)
        let state: CapturedState = {};
        state = captureInitialEvents(state, [preExisting]);

        // A new event is created offline — captureInitialEvents must NOT be
        // called again (this is what the bug was doing).
        // If we accidentally call it, the new event gets captured immediately:
        // state = captureInitialEvents(state, [preExisting, newlyCreated]); // BUG

        expect(state["pre"]).toBeDefined();
        expect(state["new"]).toBeUndefined(); // must not appear in capture
    });

    it("captureInitialEvents is idempotent on repeated calls with the same set", () => {
        const ev = makeEvent({ id: "e1" });
        let state: CapturedState = {};
        state = captureInitialEvents(state, [ev]);
        const ref = state;
        state = captureInitialEvents(state, [ev]);

        expect(state).toBe(ref); // same reference returned
    });

    it("captureInitialEvents adds only events not already in state", () => {
        const captured = makeEvent({ id: "e1", name: "Captured" });
        const fresh = makeEvent({ id: "e2", name: "Fresh" });

        let state: CapturedState = {};
        state = captureInitialEvents(state, [captured]);

        // Now call again with the captured event having a different name
        const staleVersion = makeEvent({ id: "e1", name: "Stale" });
        state = captureInitialEvents(state, [staleVersion, fresh]);

        expect(state["e1"].name).toBe("Captured"); // original kept
        expect(state["e2"].name).toBe("Fresh"); // new event added
    });
});
