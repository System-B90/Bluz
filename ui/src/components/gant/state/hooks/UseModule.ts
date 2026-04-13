import { ModuleDocument } from "@/api-client/gant/module";
import { ModuleId } from "@/api-shared/types/gant/curriculum";
import { useCurriculumState } from "@/components/gant/state/provider";

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
