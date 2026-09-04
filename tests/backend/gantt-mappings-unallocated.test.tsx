// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
    GanttCurriculum,
    GanttCurriculumModuleDayMapping,
    GanttEvent,
    GanttModule,
    GanttSyllabus,
} from "@/api-shared/types/gantt/models";
import { useGanttMappingsMerge } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-mappings-merge";
import { useGanttUnallocated } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-unallocated";

/**
 * The mapping split and the "unallocated" panel (#89). Both are scoped to one
 * curriculum out of a global table, and the panel's rule — a module counts as
 * unallocated until *every* one of its events is placed — is subtle enough to
 * be worth pinning.
 */

const mapping = (
    over: Partial<GanttCurriculumModuleDayMapping>,
): GanttCurriculumModuleDayMapping =>
    ({
        curriculumId: "c1",
        moduleId: "m1",
        dayId: "d1",
        ...over,
    }) as GanttCurriculumModuleDayMapping;

afterEach(cleanup);

describe("useGanttMappingsMerge", () => {
    const globalMappings = {
        x1: mapping({}),
        x2: mapping({ dayId: "d2" }),
        x3: mapping({ dayId: "d2" }),
        x4: mapping({ eventId: "e1", dayId: "d3" }),
        x5: mapping({ curriculumId: "cOther", dayId: "d9" }),
    } as Record<string, GanttCurriculumModuleDayMapping>;

    const render = () =>
        renderHook(() => useGanttMappingsMerge(globalMappings, "c1")).result;

    it("collects a module's days, de-duplicated", () => {
        expect(render().current.moduleMappings).toEqual({
            m1: [ "d1", "d2" ],
        });
    });

    it("keeps event mappings out of the module list", () => {
        const { moduleMappings, eventMappings } = render().current;

        expect(moduleMappings.m1).not.toContain("d3");
        expect(eventMappings).toEqual({ e1: "d3" });
    });

    it("ignores another curriculum's mappings in all three shapes", () => {
        const { moduleMappings, eventMappings, curriculumMappings } =
            render().current;

        expect(Object.values(moduleMappings).flat()).not.toContain("d9");
        expect(Object.values(eventMappings)).not.toContain("d9");
        expect(curriculumMappings.x5).toBeUndefined();
        expect(Object.keys(curriculumMappings)).toHaveLength(4);
    });

    it("returns empty shapes for an empty table", () => {
        const result = renderHook(() =>
            useGanttMappingsMerge({}, "c1"),
        ).result;

        expect(result.current).toEqual({
            curriculumMappings: {},
            eventMappings: {},
            moduleMappings: {},
        });
    });
});

describe("useGanttUnallocated", () => {
    const curriculum = {
        id: "c1",
        syllabuses: [ "s1" ],
    } as unknown as GanttCurriculum;
    const syllabuses = {
        s1: { id: "s1", title: "סילבוס", modules: [ "m1" ] },
    } as unknown as Record<string, GanttSyllabus>;
    const modules = {
        m1: { id: "m1", title: "מודול", events: [ "e1", "e2" ] },
    } as unknown as Record<string, GanttModule>;
    const events = {
        e1: { id: "e1", title: "אירוע א" },
        e2: { id: "e2", title: "אירוע ב" },
    } as unknown as Record<string, GanttEvent>;

    const render = (
        eventMappings: Record<string, string> = {},
        moduleMappings: Record<string, Array<string>> = {},
    ) =>
        renderHook(() =>
            useGanttUnallocated({
                curriculum,
                eventMappings,
                events,
                moduleMappings,
                modules,
                syllabuses,
            }),
        ).result;

    it("lists every unplaced event under its syllabus", () => {
        const result = render();

        expect(result.current.unallocatedBySyllabus).toHaveLength(1);
        const [ group ] = result.current.unallocatedBySyllabus;
        expect(group.syllabusTitle).toBe("סילבוס");
        expect(group.events.map((e) => e.id)).toEqual([ "e1", "e2" ]);
        expect(group.events[ 0 ].moduleId).toBe("m1");
        expect(result.current.unallocatedCount).toBe(3);
    });

    it("keeps a partly-placed module in the list", () => {
        const result = render({ e1: "d1" });

        const [ group ] = result.current.unallocatedBySyllabus;
        expect(group.modules.map((m) => m.id)).toEqual([ "m1" ]);
        expect(group.events.map((e) => e.id)).toEqual([ "e2" ]);
    });

    it("drops a module once every one of its events is placed", () => {
        const result = render({ e1: "d1", e2: "d2" });

        expect(result.current.unallocatedBySyllabus).toEqual([]);
        expect(result.current.unallocatedCount).toBe(0);
    });

    it("drops a module that is itself mapped to a day", () => {
        const result = render({}, { m1: [ "d1" ] });

        const [ group ] = result.current.unallocatedBySyllabus;
        expect(group.modules).toEqual([]);
        // Its events are still individually unplaced, so they remain listed.
        expect(group.events).toHaveLength(2);
    });

    it("counts an eventless module as unallocated", () => {
        const result = renderHook(() =>
            useGanttUnallocated({
                curriculum,
                eventMappings: {},
                events: {},
                moduleMappings: {},
                modules: {
                    m1: { id: "m1", title: "ריק", events: [] },
                } as unknown as Record<string, GanttModule>,
                syllabuses,
            }),
        ).result;

        expect(result.current.unallocatedCount).toBe(1);
    });

    it("returns nothing without a curriculum, and skips unknown syllabuses", () => {
        expect(
            renderHook(() =>
                useGanttUnallocated({
                    curriculum: undefined,
                    eventMappings: {},
                    events,
                    moduleMappings: {},
                    modules,
                    syllabuses,
                }),
            ).result.current.unallocatedBySyllabus,
        ).toEqual([]);

        cleanup();

        expect(
            renderHook(() =>
                useGanttUnallocated({
                    curriculum,
                    eventMappings: {},
                    events,
                    moduleMappings: {},
                    modules,
                    syllabuses: {},
                }),
            ).result.current.unallocatedBySyllabus,
        ).toEqual([]);
    });
});
