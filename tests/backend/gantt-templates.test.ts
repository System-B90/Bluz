import { describe, it, expect } from "vitest";

import { GanttDayIndex } from "@/api-shared/types/gantt/models";
import {
    CURRICULUM_TEMPLATES,
    KNAS_TEMPLATE,
    resolveWeekDayMinutes,
    type GanttCurriculumTemplate,
} from "@/api-shared/types/gantt/templates";

describe("Gantt curriculum templates (#29)", () => {
    it("ships the הכנ\"ס preset in the registry", () => {
        expect(CURRICULUM_TEMPLATES).toContain(KNAS_TEMPLATE);
        expect(CURRICULUM_TEMPLATES.some((t) => t.id === "knas")).toBe(true);
    });

    it("the הכנ\"ס preset defines weeks and approximate working hours", () => {
        expect(KNAS_TEMPLATE.weekCount).toBeGreaterThan(0);
        // Sun–Thu full days, Friday short, Saturday closed.
        expect(KNAS_TEMPLATE.defaultDayMinutes[GanttDayIndex.Sunday]).toBe(540);
        expect(KNAS_TEMPLATE.defaultDayMinutes[GanttDayIndex.Thursday]).toBe(
            540,
        );
        expect(KNAS_TEMPLATE.defaultDayMinutes[GanttDayIndex.Friday]).toBe(300);
        expect(KNAS_TEMPLATE.defaultDayMinutes[GanttDayIndex.Saturday]).toBe(0);
    });

    it("resolveWeekDayMinutes returns the default config when no override", () => {
        expect(resolveWeekDayMinutes(KNAS_TEMPLATE, 0)).toEqual(
            KNAS_TEMPLATE.defaultDayMinutes,
        );
    });

    it("resolveWeekDayMinutes merges sparse per-week overrides over the default", () => {
        const template: GanttCurriculumTemplate = {
            id: "t",
            label: "T",
            weekCount: 3,
            defaultDayMinutes: {
                [GanttDayIndex.Sunday]: 480,
                [GanttDayIndex.Monday]: 480,
            },
            weekOverrides: {
                1: { [GanttDayIndex.Sunday]: 0 },
            },
        };

        // Week 0 → pure default.
        expect(resolveWeekDayMinutes(template, 0)).toEqual({
            [GanttDayIndex.Sunday]: 480,
            [GanttDayIndex.Monday]: 480,
        });
        // Week 1 → Sunday overridden to 0, Monday inherited.
        expect(resolveWeekDayMinutes(template, 1)).toEqual({
            [GanttDayIndex.Sunday]: 0,
            [GanttDayIndex.Monday]: 480,
        });
    });
});
