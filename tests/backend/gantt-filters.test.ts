import { describe, expect, it } from "vitest";

import { GanttSyllabus } from "@/api-shared/types/gantt/models";
import {
    EMPTY_GANTT_FILTERS,
    GANTT_FILTER_DEFINITIONS,
    GanttFilterLookups,
    GanttFilterValues,
} from "@/components/gantt/state/filters/definitions";

function syllabus(overrides: Partial<GanttSyllabus> = {}): GanttSyllabus {
    return {
        id: "s-1",
        title: "מקצוע",
        hiveIds: [],
        modules: [],
        ...overrides,
    } as GanttSyllabus;
}

const LOOKUPS: GanttFilterLookups = {
    getCourse: (id) =>
        ({ "c-1": { id: "c-1", name: "מסלול א" }, "c-2": { id: "c-2", name: "מסלול ב" } })[
            id as string
        ] as never,
    getInstructor: (id) =>
        ({ 1: { display_name: "דנה" }, 2: { display_name: "יואב" } })[id] as never,
};

const byKey = Object.fromEntries(
    GANTT_FILTER_DEFINITIONS.map((def) => [ def.key, def ]),
);
const courseFilter = byKey.courseIds;
const leadFilter = byKey.leadInstructorIds;

/** Mirrors the provider's AND composition over the active definitions. */
function matches(item: GanttSyllabus, values: GanttFilterValues): boolean {
    return GANTT_FILTER_DEFINITIONS.filter((def) =>
        def.isActive(values[def.key] as never),
    ).every((def) => def.matches(item, values[def.key] as never));
}

describe("filter registry", () => {
    it("registers exactly the course and lead-instructor filters", () => {
        // The provider iterates this array, so an entry silently dropped here
        // disables that filter everywhere at once.
        expect(GANTT_FILTER_DEFINITIONS.map((def) => def.key).sort()).toEqual([
            "courseIds",
            "leadInstructorIds",
        ]);
    });

    it("gives every registered key an empty default", () => {
        for (const def of GANTT_FILTER_DEFINITIONS) {
            expect(EMPTY_GANTT_FILTERS[def.key]).toEqual([]);
            expect(def.isActive(EMPTY_GANTT_FILTERS[def.key] as never)).toBe(false);
        }
    });
});

describe("course filter", () => {
    it("is inactive until a course is chosen", () => {
        expect(courseFilter.isActive([] as never)).toBe(false);
        expect(courseFilter.isActive([ "c-1" ] as never)).toBe(true);
    });

    it("matches a syllabus carrying the selected course", () => {
        expect(
            courseFilter.matches(syllabus({ courseIds: [ "c-1" ] }), [ "c-1" ] as never),
        ).toBe(true);
    });

    it("does not match a syllabus in a different course", () => {
        expect(
            courseFilter.matches(syllabus({ courseIds: [ "c-2" ] }), [ "c-1" ] as never),
        ).toBe(false);
    });

    it("matches on any overlap, not on containing every selection", () => {
        // A syllabus in מסלול א should appear when filtering for א or ב --
        // the control is a multi-select union, not an intersection.
        expect(
            courseFilter.matches(
                syllabus({ courseIds: [ "c-1" ] }),
                [ "c-1", "c-2" ] as never,
            ),
        ).toBe(true);
    });

    it("excludes a syllabus with no courses at all", () => {
        expect(courseFilter.matches(syllabus({ courseIds: [] }), [ "c-1" ] as never)).toBe(
            false,
        );
    });

    it("tolerates an undefined courseIds", () => {
        // The field is optional on the model and older rows predate the
        // column, so the nullish guard is load-bearing rather than defensive.
        expect(courseFilter.matches(syllabus(), [ "c-1" ] as never)).toBe(false);
    });

    it("describes one course by name", () => {
        expect(courseFilter.describe([ "c-1" ] as never, LOOKUPS)).toBe(
            "משויכים למסלול מסלול א",
        );
    });

    it("joins two course names with וא", () => {
        expect(courseFilter.describe([ "c-1", "c-2" ] as never, LOOKUPS)).toBe(
            "משויכים למסלול מסלול א או מסלול ב",
        );
    });

    it("falls back to the raw id for an unknown course", () => {
        expect(courseFilter.describe([ "c-9" ] as never, LOOKUPS)).toContain("c-9");
    });
});

describe("lead instructor filter", () => {
    it("is inactive until an instructor is chosen", () => {
        expect(leadFilter.isActive([] as never)).toBe(false);
        expect(leadFilter.isActive([ 1 ] as never)).toBe(true);
    });

    it("matches a syllabus led by the selected instructor", () => {
        expect(
            leadFilter.matches(syllabus({ leadInstructorIds: [ 1 ] }), [ 1 ] as never),
        ).toBe(true);
    });

    it("does not match a syllabus led by someone else", () => {
        expect(
            leadFilter.matches(syllabus({ leadInstructorIds: [ 2 ] }), [ 1 ] as never),
        ).toBe(false);
    });

    it("matches when any one of several leads is selected", () => {
        expect(
            leadFilter.matches(syllabus({ leadInstructorIds: [ 2, 3 ] }), [ 1, 2 ] as never),
        ).toBe(true);
    });

    it("tolerates an undefined leadInstructorIds", () => {
        expect(leadFilter.matches(syllabus(), [ 1 ] as never)).toBe(false);
    });

    it("describes instructors by display name", () => {
        expect(leadFilter.describe([ 1 ] as never, LOOKUPS)).toBe("באחריות דנה");
        expect(leadFilter.describe([ 1, 2 ] as never, LOOKUPS)).toBe(
            "באחריות דנה או יואב",
        );
    });

    it("falls back to the raw id for an unknown instructor", () => {
        expect(leadFilter.describe([ 9 ] as never, LOOKUPS)).toBe("באחריות 9");
    });
});

describe("composition (the provider ANDs active filters)", () => {
    const item = syllabus({ courseIds: [ "c-1" ], leadInstructorIds: [ 1 ] });

    it("passes everything when nothing is selected", () => {
        expect(matches(syllabus(), EMPTY_GANTT_FILTERS)).toBe(true);
        expect(matches(item, EMPTY_GANTT_FILTERS)).toBe(true);
    });

    it("requires both filters to match when both are active", () => {
        expect(matches(item, { courseIds: [ "c-1" ], leadInstructorIds: [ 1 ] })).toBe(true);
        // Right course, wrong lead: AND, not OR.
        expect(matches(item, { courseIds: [ "c-1" ], leadInstructorIds: [ 2 ] })).toBe(false);
        expect(matches(item, { courseIds: [ "c-2" ], leadInstructorIds: [ 1 ] })).toBe(false);
    });

    it("ignores an inactive filter entirely", () => {
        // A syllabus with no lead must still show when only the course filter
        // is set -- an empty selection must not be read as "matches nothing".
        const noLead = syllabus({ courseIds: [ "c-1" ] });

        expect(matches(noLead, { courseIds: [ "c-1" ], leadInstructorIds: [] })).toBe(true);
    });

    it("excludes an unassigned syllabus once any filter is active", () => {
        expect(matches(syllabus(), { courseIds: [ "c-1" ], leadInstructorIds: [] })).toBe(
            false,
        );
    });
});
