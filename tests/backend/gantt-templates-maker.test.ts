import { describe, expect, it } from "vitest";

import { GanttDayIndex } from "@/api-shared/types/gantt/models";
import { makeCurriculum } from "@/api-shared/types/gantt/maker";
import {
    CURRICULUM_TEMPLATES,
    GanttCurriculumTemplate,
    HACHNAS_TEMPLATE,
    resolveWeekDayMinutes,
} from "@/api-shared/types/gantt/templates";

describe("makeCurriculum", () => {
    it("defaults a blank curriculum to a draft with no children", () => {
        const made = makeCurriculum();

        expect(made.id).toBeUndefined();
        expect(made.isDraft).toBe(true);
        expect(made.isArchived).toBe(false);
        expect(made.startDate).toBeNull();
        expect(made.syllabuses).toEqual([]);
        expect(made.weeks).toEqual([]);
        expect(made.title).not.toBe("");
    });

    it("keeps every supplied field, including falsy ones", () => {
        const made = makeCurriculum({
            title: "קורס",
            description: "",
            isDraft: false,
            isArchived: true,
        });

        expect(made.title).toBe("קורס");
        expect(made.isDraft).toBe(false);
        expect(made.isArchived).toBe(true);
        // `??` on an empty string keeps it; `||` would have replaced it.
        expect(made.description).toBe("");
    });
});

describe("resolveWeekDayMinutes", () => {
    const template: GanttCurriculumTemplate = {
        id: "t",
        label: "t",
        weekCount: 3,
        defaultDayMinutes: {
            [ GanttDayIndex.Sunday ]: 540,
            [ GanttDayIndex.Friday ]: 300,
        },
        weekOverrides: {
            1: { [ GanttDayIndex.Friday ]: 0 },
        },
    };

    it("returns the defaults for a week with no override", () => {
        expect(resolveWeekDayMinutes(template, 0)).toEqual(
            template.defaultDayMinutes,
        );
    });

    it("merges an override on top of the defaults", () => {
        expect(resolveWeekDayMinutes(template, 1)).toEqual({
            [ GanttDayIndex.Sunday ]: 540,
            [ GanttDayIndex.Friday ]: 0,
        });
    });

    it("does not mutate the template's defaults while merging", () => {
        resolveWeekDayMinutes(template, 1);

        expect(template.defaultDayMinutes[ GanttDayIndex.Friday ]).toBe(300);
    });
});

describe("HACHNAS template", () => {
    it("is registered and closes Shabbat with a short Friday", () => {
        expect(CURRICULUM_TEMPLATES).toContain(HACHNAS_TEMPLATE);
        expect(HACHNAS_TEMPLATE.weekCount).toBeGreaterThan(0);
        expect(
            HACHNAS_TEMPLATE.defaultDayMinutes[ GanttDayIndex.Saturday ],
        ).toBe(0);
        expect(
            HACHNAS_TEMPLATE.defaultDayMinutes[ GanttDayIndex.Friday ],
        ).toBeLessThan(
            HACHNAS_TEMPLATE.defaultDayMinutes[ GanttDayIndex.Sunday ] ?? 0,
        );
    });

    it("has a unique id per registered template", () => {
        const ids = CURRICULUM_TEMPLATES.map((t) => t.id);

        expect(new Set(ids).size).toBe(ids.length);
    });
});
