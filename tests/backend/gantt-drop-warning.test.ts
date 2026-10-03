import { describe, expect, it, vi } from "vitest";

import { GanttConstraint, GanttDayIndex } from "@/api-shared/types/gantt/models";
import { ConstraintType } from "@/api-shared/types/gantt/models/constraint";
import {
    dropWarningFor,
    DropWarningSources,
    SHIFT_OFF_TIMELINE,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/drop-warning";
import { temporalViolationsAt } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-violations";

/**
 * Pre-drop warnings (#811): the hovered cell says what the drop would break
 * before it happens, instead of a violation flag appearing afterwards.
 */

const noMonday = { id: "c1", type: ConstraintType.Temporal, forbiddenDays: [ GanttDayIndex.Monday ] } as GanttConstraint;
const sundayOnly = { id: "c2", type: ConstraintType.Temporal, allowedDays: [ GanttDayIndex.Sunday ] } as GanttConstraint;

function sources(overrides: Partial<DropWarningSources> = {}): DropWarningSources {
    return {
        constraints: { c1: noMonday, c2: sundayOnly },
        modules: {
            m1: { constraints: [], events: [ "e1", "e2" ] },
            m2: { constraints: [ { id: "c1" } ], events: [] },
        },
        events: {
            e1: { constraints: [ { id: "c1" } ] },
            e2: { constraints: [] },
        },
        days: { sun: { dayIndex: GanttDayIndex.Sunday }, mon: { dayIndex: GanttDayIndex.Monday } },
        eventMappings: {},
        linearDays: [ "sun", "mon" ],
        planShift: vi.fn(() => []),
        ...overrides,
    };
}

describe("temporalViolationsAt", () => {
    it("names allowed- and forbidden-day breaks, ignoring other constraint kinds", () => {
        expect(temporalViolationsAt([ noMonday, sundayOnly, undefined ], GanttDayIndex.Monday)).toEqual([
            "מפר ימי עבודה אסורים",
            "מפר ימי עבודה מותרים",
        ]);
        expect(temporalViolationsAt([ noMonday ], GanttDayIndex.Sunday)).toEqual([]);
    });
});

describe("dropWarningFor (#811)", () => {
    const eventMove = { type: "event-move", moduleId: "m1", eventId: "e1", sourceDayId: "sun" };

    it("warns before an event lands on a forbidden day", () => {
        expect(dropWarningFor(eventMove, { targetType: "event", dayId: "mon" }, sources()))
            .toBe("מפר ימי עבודה אסורים");
    });

    it("is quiet for a permitted day", () => {
        expect(dropWarningFor(eventMove, { targetType: "event", dayId: "sun" }, sources())).toBeNull();
    });

    it("checks a module's own constraints", () => {
        expect(dropWarningFor(
            { type: "module-move", moduleId: "m2", sourceDayId: "sun" },
            { targetType: "module", dayId: "mon" },
            sources(),
        )).toBe("מפר ימי עבודה אסורים");
    });

    it("checks every event a module drop would place", () => {
        expect(dropWarningFor(
            { type: "module-map", moduleId: "m1" },
            { targetType: "module", dayId: "mon" },
            sources(),
        )).toBe("מפר ימי עבודה אסורים");
    });

    it("refuses a shift that would push events off the timeline", () => {
        expect(dropWarningFor(
            { type: "module-shift", moduleId: "m1", sourceDayId: "sun" },
            { targetType: "module", dayId: "mon" },
            sources({ planShift: () => null }),
        )).toBe(SHIFT_OFF_TIMELINE);
    });

    it("checks where a shift moves each event", () => {
        expect(dropWarningFor(
            { type: "module-shift", moduleId: "m1", sourceDayId: "sun" },
            { targetType: "module", dayId: "mon" },
            sources({ planShift: () => [ { eventId: "e1", to: "mon" } ] }),
        )).toBe("מפר ימי עבודה אסורים");
    });

    it("never warns about the remove zone or a missing payload", () => {
        expect(dropWarningFor(eventMove, { targetType: "remove" }, sources())).toBeNull();
        expect(dropWarningFor(undefined, { targetType: "event", dayId: "mon" }, sources())).toBeNull();
    });
});
