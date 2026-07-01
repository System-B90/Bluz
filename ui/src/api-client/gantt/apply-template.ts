import { ganttApi } from "@/api-client/gantt";
import { ApiCurriculumWeek } from "@/api-shared/types/gantt/api-layer";
import { GanttCurriculumId, GanttDayIndex } from "@/api-shared/types/gantt/models";
import {
    GanttCurriculumTemplate,
    resolveWeekDayMinutes,
} from "@/api-shared/types/gantt/templates";

/**
 * Seeds a (blank) curriculum's weeks and per-day working minutes from a
 * template. Creates exactly `template.weekCount` weeks; each newly created week
 * comes back with its linked days, whose `totalWorkingMinutes` we set from the
 * template's resolved day-config.
 *
 * Used by the "create curriculum from template" flow. It talks to the Gantt API
 * directly (not the in-memory reducer), so it works before the new curriculum's
 * provider is mounted.
 */
export async function seedCurriculumFromTemplate(
    curriculumId: GanttCurriculumId,
    template: GanttCurriculumTemplate,
): Promise<void> {
    for (let weekIndex = 0; weekIndex < template.weekCount; weekIndex++) {
        const dayMinutes = resolveWeekDayMinutes(template, weekIndex);
        const hasSaturdayDuty =
            (dayMinutes[GanttDayIndex.Saturday] ?? 0) > 0;

        const newWeek = (await ganttApi.week.apiCreate({
            curriculumId,
            number: weekIndex + 1,
            comment: "",
            weekendDuty: hasSaturdayDuty,
        })) as unknown as ApiCurriculumWeek;

        await Promise.all(
            (newWeek.w2d ?? [])
                .filter((link) => {
                    const minutes =
                        dayMinutes[link.day.dayIndex as GanttDayIndex] ?? 0;
                    return link.day.totalWorkingMinutes !== minutes;
                })
                .map((link) =>
                    ganttApi.day.apiUpdate({
                        id: link.day.id,
                        totalWorkingMinutes:
                            dayMinutes[link.day.dayIndex as GanttDayIndex] ??
                            0,
                    }),
                ),
        );
    }
}
