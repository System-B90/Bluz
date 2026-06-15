import { ModuleDocument } from "@/api-client/gantt/module";
import {
    GanttModuleId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { useCurriculumState } from "@/components/gantt/state/provider";

export function useModule(moduleId: null): undefined;
export function useModule(
    moduleId: GanttModuleId,
): (ModuleDocument & { syllabusId: GanttSyllabusId }) | undefined;
export function useModule(
    moduleId: GanttModuleId | null,
): (ModuleDocument & { syllabusId: GanttSyllabusId }) | undefined {
    const state = useCurriculumState();

    if (moduleId === null) {
        return undefined;
    }

    return state.modules[moduleId];
}
