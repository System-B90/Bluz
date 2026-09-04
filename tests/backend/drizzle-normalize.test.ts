import { describe, expect, it } from "vitest";

import {
    normalizeApiSyllabus,
    normalizeCurriculumData,
} from "@/api-client/gantt/drizzle-normalize";
import { ApiCurriculum, ApiSyllabus } from "@/api-shared/types/gantt/api-layer";
import {
    GanttCurriculumId,
    GanttDayIndex,
} from "@/api-shared/types/gantt/models";

/**
 * The API → store normalizer. Everything the gantt UI reads is keyed off what
 * this produces, and its ordering guarantees (days by weekday, weeks by
 * number) are what keep the grid from rendering scrambled.
 */
const syllabus = {
    id: "s1",
    title: "סילבוס",
    s2m: [
        {
            module: {
                id: "m1",
                title: "מודול",
                m2e: [
                    {
                        event: {
                            id: "e1",
                            title: "אירוע",
                            cEC: [
                                { curriculumId: "c1", allocatedDuration: 90 },
                                { curriculumId: "cX", allocatedDuration: 30 },
                            ],
                        },
                    },
                    { event: { id: "e2", title: "אירוע ב" } },
                ],
            },
        },
    ],
} as unknown as ApiSyllabus;

const curriculum = {
    id: "c1",
    title: "גאנט",
    description: "",
    isDraft: true,
    c2s: [ { syllabus } ],
    c2w: [
        {
            week: {
                id: "w2",
                number: 2,
                w2d: [
                    {
                        weekId: "w2",
                        day: {
                            id: "d3",
                            dayIndex: GanttDayIndex.Monday,
                            totalWorkingMinutes: 540,
                        },
                    },
                    {
                        weekId: "w2",
                        day: {
                            id: "d4",
                            dayIndex: GanttDayIndex.Sunday,
                            totalWorkingMinutes: 540,
                        },
                    },
                ],
            },
        },
        { week: { id: "w1", number: 1, w2d: [] } },
    ],
} as unknown as ApiCurriculum;

describe("normalizeApiSyllabus", () => {
    it("flattens the subtree and resolves the reverse child-id arrays", () => {
        const { syllabus: doc, modules, events } = normalizeApiSyllabus(
            syllabus,
            "c1" as GanttCurriculumId,
        );

        expect(doc.modules).toEqual([ "m1" ]);
        expect(doc.curriculumId).toBe("c1");
        expect(modules[ 0 ].events).toEqual([ "e1", "e2" ]);
        expect(modules[ 0 ].syllabusId).toBe("s1");
        expect(events.map((e) => e.moduleId)).toEqual([ "m1", "m1" ]);
    });

    it("picks the allocated duration belonging to this curriculum", () => {
        const { events } = normalizeApiSyllabus(
            syllabus,
            "c1" as GanttCurriculumId,
        );

        expect(events[ 0 ].allocatedDuration).toBe(90);
    });

    it("defaults an event with no configuration for this curriculum to zero", () => {
        const { events } = normalizeApiSyllabus(
            syllabus,
            "cY" as GanttCurriculumId,
        );

        expect(events[ 0 ].allocatedDuration).toBe(0);
        expect(events[ 1 ].allocatedDuration).toBe(0);
    });

    it("survives a syllabus with no modules and a module with no events", () => {
        const bare = normalizeApiSyllabus(
            {
                id: "s9",
                title: "ריק",
                s2m: [ { module: { id: "m9", title: "מודול" } } ],
            } as unknown as ApiSyllabus,
            "c1" as GanttCurriculumId,
        );

        expect(bare.modules[ 0 ].events).toEqual([]);
        expect(bare.events).toEqual([]);
    });
});

describe("normalizeCurriculumData", () => {
    it("indexes every entity by id", () => {
        const store = normalizeCurriculumData(curriculum);

        expect(Object.keys(store.curriculums)).toEqual([ "c1" ]);
        expect(Object.keys(store.syllabuses)).toEqual([ "s1" ]);
        expect(Object.keys(store.modules)).toEqual([ "m1" ]);
        expect(Object.keys(store.events).sort()).toEqual([ "e1", "e2" ]);
    });

    it("sorts a week's days chronologically, whatever order they arrived in", () => {
        const store = normalizeCurriculumData(curriculum);

        expect(store.weeks.w2.days).toEqual([ "d4", "d3" ]);
        expect(store.days.d4.dayIndex).toBe(GanttDayIndex.Sunday);
    });

    it("sorts the curriculum's weeks by number", () => {
        const store = normalizeCurriculumData(curriculum);

        expect(store.curriculums.c1.weeks).toEqual([ "w1", "w2" ]);
    });

    it("titles weeks and days for display", () => {
        const store = normalizeCurriculumData(curriculum);

        expect(store.weeks.w2.title).toBe("שבוע 2");
        expect(store.days.d4.title).toBe("ראשון");
        expect(store.days.d4.weekId).toBe("w2");
    });

    it("defaults isArchived and tolerates a curriculum with no children", () => {
        const store = normalizeCurriculumData({
            id: "c2",
            title: "ריק",
        } as unknown as ApiCurriculum);

        expect(store.curriculums.c2.isArchived).toBe(false);
        expect(store.curriculums.c2.weeks).toEqual([]);
        expect(store.curriculums.c2.syllabuses).toEqual([]);
        expect(store.days).toEqual({});
    });
});
