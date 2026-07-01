import { GanttDayIndex } from "@/api-shared/types/gantt/models";

/** Per-day working minutes keyed by GanttDayIndex. Missing keys → 0 minutes. */
export type TemplateDayConfig = Partial<Record<GanttDayIndex, number>>;

export type GanttCurriculumTemplate = {
    /** Unique key used in code / localStorage */
    id: string;
    /** Hebrew display label */
    label: string;
    /** Number of weeks the template prescribes */
    weekCount: number;
    /**
     * Default working-minutes per day (applied uniformly to every week).
     * Each week can still be overridden individually after applying.
     */
    defaultDayMinutes: TemplateDayConfig;
    /** Optional per-week overrides: index → day-minutes. Sparse — unset weeks get defaultDayMinutes. */
    weekOverrides?: Record<number, TemplateDayConfig>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the resolved day-minutes config for a specific week index. */
export function resolveWeekDayMinutes(
    template: GanttCurriculumTemplate,
    weekIndex: number,
): TemplateDayConfig {
    const override = template.weekOverrides?.[weekIndex];
    if (!override) return template.defaultDayMinutes;
    return { ...template.defaultDayMinutes, ...override };
}

// ---------------------------------------------------------------------------
// Preset: הכנ"ס (HACHNAS) — Israeli military introductory course
// ---------------------------------------------------------------------------

/**
 * Standard HACHNAS (הכנת סגל) schedule:
 *   Sun–Thu  08:00–17:00  →  9 hours = 540 min
 *   Friday   08:00–13:00  →  5 hours = 300 min  (short day before Shabbat)
 *   Saturday              →  0  (Shabbat, base closed)
 *
 * Typical course length: 8–13 weeks preamble before the main course.
 */
export const KNAS_TEMPLATE: GanttCurriculumTemplate = {
    id: "knas",
    label: 'הכנ"ס — HACHNAS (קורס גיוס סטנדרטי)',
    weekCount: 8,
    defaultDayMinutes: {
        [GanttDayIndex.Sunday]: 540,
        [GanttDayIndex.Monday]: 540,
        [GanttDayIndex.Tuesday]: 540,
        [GanttDayIndex.Wednesday]: 540,
        [GanttDayIndex.Thursday]: 540,
        [GanttDayIndex.Friday]: 300,
        [GanttDayIndex.Saturday]: 0,
    },
};

// ---------------------------------------------------------------------------
// Registry — add future presets here
// ---------------------------------------------------------------------------

export const CURRICULUM_TEMPLATES: Array<GanttCurriculumTemplate> = [
    KNAS_TEMPLATE,
];
