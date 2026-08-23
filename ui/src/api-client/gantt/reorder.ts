import { safeApiFetcher } from "@/api-client/common";
import { GanttEventId, GanttModuleId, GanttSyllabusId } from "@/api-shared/types/gantt/models";

export async function apiReorderModules(
    syllabusId: GanttSyllabusId,
    moduleIds: Array<GanttModuleId>,
): Promise<void> {
    await safeApiFetcher<void>(
        `/api/gantt/syllabuses/${encodeURIComponent(syllabusId)}/reorder-modules`,
        { method: "POST", body: JSON.stringify({ moduleIds }) },
    );
}

export async function apiReorderEvents(
    moduleId: GanttModuleId,
    eventIds: Array<GanttEventId>,
): Promise<void> {
    await safeApiFetcher<void>(
        `/api/gantt/modules/${encodeURIComponent(moduleId)}/reorder-events`,
        { method: "POST", body: JSON.stringify({ eventIds }) },
    );
}
