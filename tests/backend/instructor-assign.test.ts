import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import {
    findPersonConflicts,
    planPersonMove,
    targetFieldFor,
    withPersonAdded,
} from "@/components/schedule/calendar/instructor-dnd/assign";
import { Event, EventType } from "@/components/schedule/types/event";

/**
 * Dragging a person between events is a move, and a move must not change who
 * they are on the way: not their role, and not their existence. Outsiders are
 * the awkward case — they live in `lecturers` only and are identified by name
 * rather than by a Hive id.
 */

function makeEvent(overrides: Partial<Event> = {}): Event {
    return {
        courses: [],
        endTime: dayjs("2026-01-14T10:00:00"),
        id: "e1",
        instructors: [],
        lecturers: [],
        locked: false,
        name: "הרצאה",
        rooms: [],
        startTime: dayjs("2026-01-14T09:00:00"),
        type: EventType.LECTURE,
        ...overrides,
    } as unknown as Event;
}

describe("targetFieldFor (#628)", () => {
    it("keeps a lecturer a lecturer when moved without Shift", () => {
        expect(
            targetFieldFor(makeEvent(), false, "lecturers"),
        ).toBe("lecturers");
    });

    it("still writes instructors for a chip that came from instructors", () => {
        expect(
            targetFieldFor(makeEvent(), false, "instructors"),
        ).toBe("instructors");
    });

    it("promotes to lecturers when Shift is held", () => {
        expect(targetFieldFor(makeEvent(), true)).toBe("lecturers");
    });

    it("falls back to instructors for an event type with no lecturers", () => {
        const exercise = makeEvent({ type: EventType.EXERCISE });

        expect(targetFieldFor(exercise, true, "lecturers")).toBe("instructors");
    });
});

describe("withPersonAdded for outsiders (#625)", () => {
    it("refuses a named outsider in the instructors field", () => {
        // `instructors` is Array<number>. Returning null here is what the
        // caller must read as "the move cannot happen", rather than dropping
        // the person from the source event and adding them nowhere.
        expect(withPersonAdded(makeEvent(), "דנה חיצונית", "instructors")).toBe(
            null,
        );
    });

    it("accepts a named outsider as a lecturer", () => {
        const updated = withPersonAdded(makeEvent(), "דנה חיצונית", "lecturers");

        expect(updated?.lecturers).toContain("דנה חיצונית");
    });
});

describe("findPersonConflicts (#627)", () => {
    const target = makeEvent({ id: "target" });
    const overlapping = makeEvent({
        endTime: dayjs("2026-01-14T09:30:00"),
        id: "other",
        lecturers: ["דנה חיצונית"],
        name: "סדנה",
        startTime: dayjs("2026-01-14T08:30:00"),
    });

    it("reports an overlap for a named outsider", () => {
        // Bailing on every non-numeric id meant outsiders never produced an
        // overlap warning at all.
        expect(
            findPersonConflicts([target, overlapping], "דנה חיצונית", target),
        ).toHaveLength(1);
    });

    it("still reports an overlap for a Hive instructor", () => {
        const busy = makeEvent({
            endTime: dayjs("2026-01-14T09:30:00"),
            id: "other",
            instructors: [7],
            startTime: dayjs("2026-01-14T08:30:00"),
        });

        expect(findPersonConflicts([target, busy], 7, target)).toHaveLength(1);
    });

    it("treats the generic outsider marker as nobody in particular", () => {
        const generic = makeEvent({
            endTime: dayjs("2026-01-14T09:30:00"),
            id: "other",
            lecturers: ["איש חוץ"],
            startTime: dayjs("2026-01-14T08:30:00"),
        });

        // Two events each carrying "somebody external" are not one person
        // double-booked.
        expect(
            findPersonConflicts([target, generic], "איש חוץ", target),
        ).toHaveLength(0);
    });

    it("ignores an event that does not overlap the target's slot", () => {
        const later = makeEvent({
            endTime: dayjs("2026-01-14T12:00:00"),
            id: "other",
            lecturers: ["דנה חיצונית"],
            startTime: dayjs("2026-01-14T11:00:00"),
        });

        expect(
            findPersonConflicts([target, later], "דנה חיצונית", target),
        ).toHaveLength(0);
    });
});

describe("planPersonMove (#625, #626)", () => {
    const target = makeEvent({ id: "target" });

    it("refuses the move when the source event is locked", () => {
        // The source keeps the person, so assigning the target too would
        // leave them on both events.
        const locked = makeEvent({ id: "source", locked: true });

        expect(planPersonMove(locked, target, 7, false, "instructors")).toEqual(
            { allowed: false, reason: "locked-source" },
        );
    });

    it("refuses the move when the target cannot hold the person", () => {
        const exercise = makeEvent({ id: "target", type: EventType.EXERCISE });
        const source = makeEvent({ id: "source" });

        expect(
            planPersonMove(source, exercise, "דנה חיצונית", false, "lecturers"),
        ).toEqual({ allowed: false, reason: "target-cannot-hold" });
    });

    it("moves an outsider between events that carry lecturers", () => {
        const source = makeEvent({ id: "source" });

        expect(
            planPersonMove(source, target, "דנה חיצונית", false, "lecturers"),
        ).toEqual({ allowed: true, field: "lecturers" });
    });

    it("keeps a Hive lecturer's role across the move", () => {
        const source = makeEvent({ id: "source" });

        expect(
            planPersonMove(source, target, 7, false, "lecturers"),
        ).toEqual({ allowed: true, field: "lecturers" });
    });
});
