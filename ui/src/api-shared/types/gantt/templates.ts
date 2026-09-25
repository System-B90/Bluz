import { GanttCurriculumId, GanttDayIndex } from "@/api-shared/types/gantt/models";

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
): TemplateDayConfig
{
    const override = template.weekOverrides?.[ weekIndex ];
    if (!override) return template.defaultDayMinutes;
    return { ...template.defaultDayMinutes, ...override };
}

// ---------------------------------------------------------------------------
// Preset: הכנ"ס (HACHNAS) — הכנת סגל
// ---------------------------------------------------------------------------

/**
 * Standard HACHNAS (הכנת סגל) schedule:
 *   Sun–Thu  08:00–17:00  →  9 hours = 540 min
 *   Friday   08:00–13:00  →  5 hours = 300 min  (short day before Shabbat)
 *   Saturday              →  0  (Shabbat, base closed)
 *
 * Typical course length: 8–13 weeks preamble before the main course.
 */
export const HACHNAS_TEMPLATE: GanttCurriculumTemplate = {
    id: "hachnas",
    label: 'הכנ"ס',
    weekCount: 8,
    defaultDayMinutes: {
        [ GanttDayIndex.Sunday ]: 540,
        [ GanttDayIndex.Monday ]: 540,
        [ GanttDayIndex.Tuesday ]: 540,
        [ GanttDayIndex.Wednesday ]: 540,
        [ GanttDayIndex.Thursday ]: 540,
        [ GanttDayIndex.Friday ]: 300,
        [ GanttDayIndex.Saturday ]: 0,
    },
};

// ---------------------------------------------------------------------------
// Registry — add future presets here
// ---------------------------------------------------------------------------

export const CURRICULUM_TEMPLATES: Array<GanttCurriculumTemplate> = [
    HACHNAS_TEMPLATE,
];

/** Persistence the template seeder needs; the client and server each supply their own. */
export type TemplateSeedOps = {
    createWeek: (payload: {
        curriculumId: GanttCurriculumId;
        number: number;
        comment: string;
        weekendDuty: boolean;
    }) => Promise<{
        w2d?: Array<{
            day: { id: string; dayIndex: number; totalWorkingMinutes: number };
        }>;
    }>;
    setDayMinutes: (dayId: string, minutes: number) => Promise<unknown>;
};

/**
 * Seeds a (blank) curriculum's weeks and per-day working minutes from a
 * template: exactly `template.weekCount` weeks, each day's
 * `totalWorkingMinutes` set from the resolved day-config. Only days whose
 * default differs from the template are written.
 */
export async function seedCurriculumFromTemplateWith(
    curriculumId: GanttCurriculumId,
    template: GanttCurriculumTemplate,
    ops: TemplateSeedOps,
): Promise<void> {
    for (let weekIndex = 0; weekIndex < template.weekCount; weekIndex++) {
        const dayMinutes = resolveWeekDayMinutes(template, weekIndex);
        const hasSaturdayDuty = (dayMinutes[GanttDayIndex.Saturday] ?? 0) > 0;

        const newWeek = await ops.createWeek({
            curriculumId,
            number: weekIndex + 1,
            comment: "",
            weekendDuty: hasSaturdayDuty,
        });

        await Promise.all(
            (newWeek.w2d ?? [])
                .filter(
                    (link) =>
                        link.day.totalWorkingMinutes !==
                        (dayMinutes[link.day.dayIndex as GanttDayIndex] ?? 0),
                )
                .map((link) =>
                    ops.setDayMinutes(
                        link.day.id,
                        dayMinutes[link.day.dayIndex as GanttDayIndex] ?? 0,
                    ),
                ),
        );
    }
}
