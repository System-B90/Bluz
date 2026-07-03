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
});
