import { useCallback } from "react";
import { moduleApi } from "@/api-client/gant/api";
import { SyllabusId, ModuleId, Module } from "@/api-shared/types/gant/curriculum";
import { useCurriculumProviderActions } from "@/components/gant/state/provider";
import { withGantErrorHandling } from "@/components/gant/state/hooks/gant-funcs/WithGantErrorHandling";

export function useModuleActions()
{
    const { dispatch } = useCurriculumProviderActions();

    const createModule = useCallback(async (title: string, syllabusId: SyllabusId, description: string = '', hiveIds: number[] = []) =>
    {
        return withGantErrorHandling(async () =>
        {
            const newModule = await moduleApi.apiCreate({ title, syllabusId, description, hiveIds });
            dispatch({ type: 'ADD_MODULE', payload: { module: newModule, syllabusId } });
            return newModule;
        }, "Failed to create module:");
    }, [ dispatch ]);

    const updateModule = useCallback(async (id: ModuleId, updates: Partial<Module>) =>
    {
        return withGantErrorHandling(async () =>
        {
            const updatedModule = await moduleApi.apiUpdate({ id, ...updates });
            dispatch({ type: 'UPDATE_MODULE', payload: { id, updates: updatedModule } });
            return updatedModule;
        }, `Failed to update module (ID: ${id}):`);
    }, [ dispatch ]);

    const removeModule = useCallback(async (syllabusId: SyllabusId, moduleId: ModuleId) =>
    {
        return withGantErrorHandling(async () =>
        {
            await moduleApi.apiDelete(moduleId);
            dispatch({ type: 'REMOVE_MODULE', payload: { syllabusId, moduleId } });
        }, `Failed to remove module (ID: ${moduleId}):`);
    }, [ dispatch ]);

    const linkModuleToSyllabus = useCallback(async (syllabusId: SyllabusId, moduleId: ModuleId) =>
    {
        return withGantErrorHandling(async () =>
        {
            const linkedModule = await moduleApi.apiLink(moduleId, syllabusId);
            dispatch({ type: 'ADD_MODULE', payload: { module: linkedModule, syllabusId } });
            return linkedModule;
        }, `Failed to link module (ID: ${moduleId}) to syllabus (ID: ${syllabusId}):`);
    }, [ dispatch ]);

    return { createModule, updateModule, removeModule, linkModuleToSyllabus } as const;
}