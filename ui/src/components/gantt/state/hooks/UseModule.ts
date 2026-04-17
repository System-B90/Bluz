import { ModuleDocument } from "@/api-client/gantt/module";
import { ModuleId } from "@/api-shared/types/gantt/curriculum";
import { useCurriculumState } from "@/components/gantt/state/provider";

export function useModule(moduleId: null): undefined;
export function useModule(moduleId: ModuleId): ModuleDocument | undefined;
export function useModule(moduleId: ModuleId | null): ModuleDocument | undefined
{
    const state = useCurriculumState();

    if (moduleId === null)
    {
        return undefined;
    }

    return state.modules[ moduleId ];
}
