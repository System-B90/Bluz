import { ganttApi } from "@/api-client/gantt";
import { ApiCurriculumWeek } from "@/api-shared/types/gantt/api-layer";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import {
    GanttCurriculumTemplate,
    seedCurriculumFromTemplateWith,
} from "@/api-shared/types/gantt/templates";

/**
 * Seeds a (blank) curriculum from a template through the Gantt API.
 *
 * Used by the "create curriculum from template" flow. It talks to the Gantt API
 * directly (not the in-memory reducer), so it works before the new curriculum's
 * provider is mounted.
 */
export async function seedCurriculumFromTemplate(
    curriculumId: GanttCurriculumId,
    template: GanttCurriculumTemplate,
): Promise<void> {
    await seedCurriculumFromTemplateWith(curriculumId, template, {
        createWeek: async (payload) =>
            (await ganttApi.week.apiCreate(
                payload,
            )) as unknown as ApiCurriculumWeek,
        setDayMinutes: (id, totalWorkingMinutes) =>
            ganttApi.day.apiUpdate({ id, totalWorkingMinutes }),
    });
}
