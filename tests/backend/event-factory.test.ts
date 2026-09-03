import { describe, it, expect } from "vitest";

import { createEventFactory } from "@/components/schedule/calendar/calendar-provider/EventFactory";

describe("createEventFactory", () => {
    it("carries the color override through for a new event", () => {
        const event = createEventFactory(
            { name: "Test", color: "custom-1" },
            true,
        );
        expect(event.color).toBe("custom-1");
    });

    it("carries the color override through when editing an existing event", () => {
        const event = createEventFactory(
            { id: "evt-1", name: "Test", color: "subject-1" },
            false,
        );
        expect(event.color).toBe("subject-1");
    });

    it("leaves color undefined when no override is set", () => {
        const event = createEventFactory({ name: "Test" }, true);
        expect(event.color).toBeUndefined();
    });

    it("reverting an override (color: undefined) does not resurrect a previous value", () => {
        const event = createEventFactory(
            { id: "evt-1", name: "Test", color: undefined },
            false,
        );
        expect(event.color).toBeUndefined();
    });

    // Provenance/disambiguation fields the gantt cut stamps on an event; must
    // survive every save or the event silently disowns the gantt occurrence
    // it was cut from (#498).
    it("carries gantt provenance fields and hiveQueues through for a new event", () => {
        const event = createEventFactory(
            {
                name: "Test",
                ganttEventId: "gantt-evt-1",
                ganttOccurrenceDate: "2024-03-04",
                hiveQueues: { "course-1": 42 },
            },
            true,
        );
        expect(event.ganttEventId).toBe("gantt-evt-1");
        expect(event.ganttOccurrenceDate).toBe("2024-03-04");
        expect(event.hiveQueues).toEqual({ "course-1": 42 });
    });

    it("carries gantt provenance fields and hiveQueues through when editing an existing event", () => {
        const event = createEventFactory(
            {
                id: "evt-1",
                name: "Test",
                ganttEventId: "gantt-evt-1",
                ganttOccurrenceDate: "2024-03-04",
                hiveQueues: { "course-1": 42 },
            },
            false,
        );
        expect(event.ganttEventId).toBe("gantt-evt-1");
        expect(event.ganttOccurrenceDate).toBe("2024-03-04");
        expect(event.hiveQueues).toEqual({ "course-1": 42 });
    });

    it("leaves gantt provenance fields and hiveQueues undefined when not set", () => {
        const event = createEventFactory({ name: "Test" }, true);
        expect(event.ganttEventId).toBeUndefined();
        expect(event.ganttOccurrenceDate).toBeUndefined();
        expect(event.hiveQueues).toBeUndefined();
    });

    it("carries the fake marker through for both new and edited events", () => {
        expect(createEventFactory({ name: "Test", fake: true }, true).fake).toBe(
            true,
        );
        expect(
            createEventFactory(
                { id: "evt-1", name: "Test", fake: true },
                false,
            ).fake,
        ).toBe(true);
    });
});
