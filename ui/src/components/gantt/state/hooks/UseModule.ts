import { ModuleDocument } from "@/api-client/gantt/module";
import { ModuleId, SyllabusId } from "@/api-shared/types/gantt/curriculum";
import { useCurriculumState } from "@/components/gantt/state/provider";

export function useModule(moduleId: null): undefined;
export function useModule(moduleId: ModuleId): (ModuleDocument & { syllabusId: SyllabusId; }) | undefined;
export function useModule(moduleId: ModuleId | null): (ModuleDocument & { syllabusId: SyllabusId; }) | undefined
{
    const state = useCurriculumState();

    if (moduleId === null)
    {
        return undefined;
    }

    return state.modules[ moduleId ];
}
