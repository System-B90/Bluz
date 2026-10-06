import { describe, expect, it, vi } from "vitest";

import { GanttSyllabus } from "@/api-shared/types/gantt/models";
import { dropWarningFor } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/drop-warning";
import {
    AlignmentSources,
    shuffleAlignmentWarning,
    shuffleMinutesOnDay,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/shuffle-alignment";
import { GANTT_FILTER_DEFINITIONS, shuffleFilterOptions } from "@/components/gantt/state/filters/definitions";

/**
 * #886: a syllabus's shuffles share the same block every day, so a drop that
 * leaves one shuffle with more time on a day than another warns first. Events
 * limited to some courses are exempt; syllabuses don't constrain each other.
 */

// s1 has shuffles A and B. On "sun": a1 (A, 60) and b1 (B, 60) — aligned.
// all1 (no shuffles ⇒ both) is unmapped; a2 (A, 60) is unmapped.
// c1 is limited to a course; x1 belongs to another syllabus with one shuffle.
function sources(eventMappings: Record<string, string> = { a1: "sun", b1: "sun" }): AlignmentSources {
    return {
        syllabuses: { s1: { shuffles: [ "A", "B" ] }, s2: { shuffles: [ "A", "C" ] } },
        modules: {
            m1: { syllabusId: "s1", events: [ "a1", "b1", "a2", "all1", "c1" ] },
            m2: { syllabusId: "s2", events: [ "x1" ] },
        },
        events: {
            a1: { moduleId: "m1", shuffles: [ "A" ], minimumDuration: 60 },
            b1: { moduleId: "m1", shuffles: [ "B" ], minimumDuration: 60 },
            a2: { moduleId: "m1", shuffles: [ "A" ], minimumDuration: 60 },
            all1: { moduleId: "m1", minimumDuration: 90 },
            c1: { moduleId: "m1", shuffles: [], courseIds: [ "course-x" ], minimumDuration: 120 },
            x1: { moduleId: "m2", shuffles: [ "A" ], minimumDuration: 45 },
        },
        eventMappings,
    };
}

describe("shuffleMinutesOnDay", () => {
    it("counts an untagged event for every shuffle and skips course-limited events", () => {
        const totals = shuffleMinutesOnDay("s1", "sun", { a1: "sun", all1: "sun", c1: "sun", x1: "sun" }, sources());
        expect(Object.fromEntries(totals)).toEqual({ A: 150, B: 90 });
    });
});

describe("shuffleAlignmentWarning (#886)", () => {
    it("warns when a drop gives one shuffle more time than another", () => {
        const warning = shuffleAlignmentWarning([ { eventId: "a2", to: "sun" } ], sources());
        expect(warning).toContain("לא יתחילו ויסתיימו יחד");
        expect(warning).toContain("A");
        expect(warning).toContain("B");
    });

    it("warns about the day an event leaves, too", () => {
        expect(shuffleAlignmentWarning([ { eventId: "a1", to: "mon" } ], sources())).not.toBeNull();
    });

    it("is quiet when the event runs for every shuffle", () => {
        expect(shuffleAlignmentWarning([ { eventId: "all1", to: "sun" } ], sources())).toBeNull();
    });

    it("exempts events limited to some courses", () => {
        expect(shuffleAlignmentWarning([ { eventId: "c1", to: "sun" } ], sources())).toBeNull();
    });

    it("leaves other syllabuses alone", () => {
        expect(shuffleAlignmentWarning([ { eventId: "x1", to: "sun" } ], sources())).not.toBeNull();
        // ...but x1's own syllabus (s2: A, C) is what goes out of step, not s1.
        const onlyS1Aligned = sources({ a1: "sun", b1: "sun", x1: "mon" });
        expect(shuffleAlignmentWarning([ { eventId: "b1", to: "sun" } ], onlyS1Aligned)).toBeNull();
    });

    it("doesn't blame a drop for an imbalance that was already there", () => {
        const alreadyOff = sources({ a1: "sun" });
        expect(shuffleAlignmentWarning([ { eventId: "a2", to: "sun" } ], alreadyOff)).toBeNull();
    });

    it("reaches the hovered cell through dropWarningFor", () => {
        const s = sources();
        const warning = dropWarningFor(
            { type: "event-map", moduleId: "m1", eventId: "a2" },
            { targetType: "event", dayId: "sun" },
            {
                constraints: {},
                modules: {},
                events: {},
                days: {},
                eventMappings: s.eventMappings as Record<string, string>,
                linearDays: [ "sun", "mon" ],
                planShift: vi.fn(() => []),
                alignment: { syllabuses: s.syllabuses, modules: s.modules, events: s.events },
            },
        );
        expect(warning).toContain("לא יתחילו ויסתיימו יחד");
    });
});

describe("shuffle filter (#886)", () => {
    const shuffleFilter = GANTT_FILTER_DEFINITIONS.find((def) => def.key === "shuffleNames")!;
    const syllabus = (shuffles?: Array<string>) => ({ id: "s", title: "t", hiveIds: [], modules: [], shuffles }) as GanttSyllabus;

    it("keeps syllabuses that have any chosen shuffle", () => {
        expect(shuffleFilter.matches(syllabus([ "A", "B" ]), [ "B" ] as never)).toBe(true);
        expect(shuffleFilter.matches(syllabus([ "A" ]), [ "B" ] as never)).toBe(false);
        expect(shuffleFilter.matches(syllabus(), [ "A" ] as never)).toBe(false);
    });

    it("offers every shuffle name once", () => {
        expect(shuffleFilterOptions([ { shuffles: [ "לחם", "ניצה" ] }, { shuffles: [ "ניצה" ] }, undefined ]))
            .toEqual([ "לחם", "ניצה" ]);
    });
});
