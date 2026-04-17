import { useCallback } from "react";

import { moduleApi } from "@/api-client/gantt";
import { GanttCurriculumId, GanttModule, GanttModuleId, GanttSyllabusId } from "@/api-shared/types/gantt/curriculum";
import { withGantErrorHandling } from "@/components/gantt/state/hooks/gantt-funcs/WithGantErrorHandling";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

export function useModuleActions()
{
    const { dispatch } = useCurriculumProviderActions();

    const createModule = useCallback(async (title: string, syllabusId: GanttSyllabusId, description: string = '', hiveIds: number[] = []) =>
    {
        return withGantErrorHandling(async () =>
        {
            const newModule = await moduleApi.apiCreate({ title, syllabusId, description, hiveIds });
            dispatch({ type: 'ADD_MODULE', payload: { module: newModule, syllabusId } });
            return newModule;
        }, "Failed to create module:");
    }, [ dispatch ]);

    const updateModule = useCallback(async (id: GanttModuleId, updates: Partial<GanttModule>) =>
    {
        return withGantErrorHandling(async () =>
        {
            const updatedModule = await moduleApi.apiUpdate({ id, ...updates });
            dispatch({ type: 'UPDATE_MODULE', payload: { id, updates: updatedModule } });
            return updatedModule;
        }, `Failed to update module (ID: ${id}):`);
    }, [ dispatch ]);

    const deleteModule = useCallback(async (syllabusId: GanttSyllabusId, moduleId: GanttModuleId) =>
    {
        return withGantErrorHandling(async () =>
        {
            await moduleApi.apiDelete(moduleId);
            dispatch({ type: 'REMOVE_MODULE', payload: { syllabusId, moduleId } });
        }, `Failed to remove module (ID: ${moduleId}):`);
    }, [ dispatch ]);

    const linkModuleToSyllabus = useCallback(async (syllabusId: GanttSyllabusId, moduleId: GanttModuleId) =>
    {
        return withGantErrorHandling(async () =>
        {
            const linkedModule = await moduleApi.apiLink(moduleId, syllabusId);
            dispatch({ type: 'ADD_MODULE', payload: { module: linkedModule, syllabusId } });
            return linkedModule;
        }, `Failed to link module (ID: ${moduleId}) to syllabus (ID: ${syllabusId}):`);
    }, [ dispatch ]);

    const unlinkModuleToSyllabus = useCallback(async (syllabusId: GanttSyllabusId, moduleId: GanttModuleId) =>
    {
        return withGantErrorHandling(async () =>
        {
            await moduleApi.apiUnlink(moduleId, syllabusId);
            dispatch({ type: 'REMOVE_MODULE', payload: { moduleId, syllabusId } });
        }, `Failed to unlink module (ID: ${moduleId}) from syllabus (ID: ${syllabusId}):`);
    }, [ dispatch ]);

    const allocateTimeToModule = useCallback(async (moduleId: GanttModuleId, curriculumId: GanttCurriculumId, allocatedDuration: number) =>
    {
        return withGantErrorHandling(async () =>
        {
            await moduleApi.apiSetAllocatedTime(moduleId, curriculumId, allocatedDuration);
            dispatch({ type: 'ALLOCATE_TIME_TO_MODULE', payload: { moduleId, curriculumId, duration: allocatedDuration } });
        }, `Failed to allocate time to module (ID: ${moduleId}):`);
    }, [ dispatch ]);

    return { createModule, updateModule, deleteModule, linkModuleToSyllabus, unlinkModuleToSyllabus, allocateTimeToModule } as const;
}
