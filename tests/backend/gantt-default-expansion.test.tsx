// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Course } from "@/api-shared/types/course";
import { defaultExpandedSyllabusIds } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/default-expansion";
import { useGanttExpansion } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-expansion";

const state = {
    syllabuses: {
        s1: { modules: [ "m1" ], courseIds: [ "apollo" ] },
        s2: { modules: [ "m2" ], courseIds: [ "mivtzar" ] },
        s3: { modules: [ "m3" ], courseIds: [] },
    },
    modules: {
        m1: { events: [], defaultOrchestratorId: 7 },
        m2: { events: [ "e2" ], defaultOrchestratorId: null },
        m3: { events: [], defaultOrchestratorId: null },
    },
    events: { e2: { orchestratorId: null } },
};
const course = (id: string, parentId: null | string, instructorIds: Array<number> = []) =>
    ({ id, name: id, color: null, parentId, instructorIds }) as Course;
const courses = [ course("bis", null), course("apollo", "bis"), course("team-a", "apollo", [ 5 ]), course("mivtzar", "bis") ];
const ids = [ "s1", "s2", "s3" ];

describe("defaultExpandedSyllabusIds", () => {
    it("opens only the syllabuses the user orchestrates", () => {
        expect(defaultExpandedSyllabusIds(ids, state, courses, 7)).toEqual([ "s1" ]);
    });

    it("falls back to syllabuses of the user's courses, ancestors included, plus course-less ones", () => {
        expect(defaultExpandedSyllabusIds(ids, state, courses, 5)).toEqual([ "s1", "s3" ]);
    });

    it("opens nothing for a user with no courses and no orchestration, or no user at all", () => {
        expect(defaultExpandedSyllabusIds(ids, state, courses, 99)).toEqual([ "s3" ]);
        expect(defaultExpandedSyllabusIds(ids, state, courses, null)).toEqual([]);
    });
});

describe("useGanttExpansion defaults", () => {
    it("starts with only the default syllabuses open and a late default still applies until touched", () => {
        const { result, rerender } = renderHook(({ open }) => useGanttExpansion(ids, false, open), {
            initialProps: { open: [] as Array<string> },
        });
        expect(ids.map((id) => result.current.isSyllabusExpanded(id))).toEqual([ false, false, false ]);
        rerender({ open: [ "s1" ] });
        expect(ids.map((id) => result.current.isSyllabusExpanded(id))).toEqual([ true, false, false ]);
        act(() => result.current.toggleSyllabus("s2"));
        rerender({ open: [ "s3" ] });
        expect(ids.map((id) => result.current.isSyllabusExpanded(id))).toEqual([ true, true, false ]);
    });

    it("opens and closes every row at once", () => {
        const { result } = renderHook(() => useGanttExpansion(ids, false, []));
        act(() => result.current.setAllRows(true, [], [ "m1", "m2" ]));
        expect(ids.every((id) => result.current.isSyllabusExpanded(id))).toBe(true);
        expect(result.current.isModuleExpanded("m2")).toBe(true);
        act(() => result.current.setAllRows(false, ids, [ "m1", "m2" ]));
        expect(ids.some((id) => result.current.isSyllabusExpanded(id))).toBe(false);
        expect(result.current.isModuleExpanded("m2")).toBe(false);
    });
});
