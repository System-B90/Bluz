import { useCallback } from "react";

import { ganttApi } from "@/api-client/gantt";
import {
    GanttCurriculumId,
    GanttModule,
    GanttModuleId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { withGantErrorHandling } from "@/components/gantt/state/hooks/gantt-funcs/WithGantErrorHandling";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

export function useModuleActions() {
    const { dispatch } = useCurriculumProviderActions();

    const createModule = useCallback(
        async (
            title: string,
            syllabusId: GanttSyllabusId,
            description: string = "",
            hiveIds: Array<number> = [],
        ) => {
            return await withGantErrorHandling(async () => {
                const newModule = await ganttApi.module.apiCreate({
                    title,
                    syllabusId,
                    description,
                    hiveIds,
                });
                dispatch({
                    type: "ADD_MODULE",
                    payload: { module: newModule, syllabusId },
                });
                return newModule;
            }, "Failed to create module:");
        },
        [dispatch],
    );

    const updateModule = useCallback(
        async (id: GanttModuleId, updates: Partial<GanttModule>) => {
            return await withGantErrorHandling(async () => {
                const updatedModule = await ganttApi.module.apiUpdate({
                    id,
                    ...updates,
                });
                dispatch({
                    type: "UPDATE_MODULE",
                    payload: { id, updates: updatedModule },
                });
                return updatedModule;
            }, `Failed to update module (ID: ${id}):`);
        },
        [dispatch],
    );

    const deleteModule = useCallback(
        async (syllabusId: GanttSyllabusId, moduleId: GanttModuleId) => {
            return await withGantErrorHandling(async () => {
                await ganttApi.module.apiDelete(moduleId);
                dispatch({
                    type: "REMOVE_MODULE",
                    payload: { syllabusId, moduleId },
                });
            }, `Failed to remove module (ID: ${moduleId}):`);
        },
        [dispatch],
    );

    const linkModuleToSyllabus = useCallback(
        async (syllabusId: GanttSyllabusId, moduleId: GanttModuleId) => {
            return await withGantErrorHandling(async () => {
                const linkedModule = await ganttApi.module.apiLink(
                    moduleId,
                    syllabusId,
                );
                dispatch({
                    type: "ADD_MODULE",
                    payload: { module: linkedModule, syllabusId },
                });
                return linkedModule;
            }, `Failed to link module (ID: ${moduleId}) to syllabus (ID: ${syllabusId}):`);
        },
        [dispatch],
    );

    const unlinkModuleToSyllabus = useCallback(
        async (syllabusId: GanttSyllabusId, moduleId: GanttModuleId) => {
            return await withGantErrorHandling(async () => {
                await ganttApi.module.apiUnlink(moduleId, syllabusId);
                dispatch({
                    type: "REMOVE_MODULE",
                    payload: { moduleId, syllabusId },
                });
            }, `Failed to unlink module (ID: ${moduleId}) from syllabus (ID: ${syllabusId}):`);
        },
        [dispatch],
    );

    const allocateTimeToModule = useCallback(
        async (
            moduleId: GanttModuleId,
            curriculumId: GanttCurriculumId,
            allocatedDuration: number,
        ) => {
            return await withGantErrorHandling(async () => {
                await ganttApi.module.apiSetAllocatedTime(
                    moduleId,
                    curriculumId,
                    allocatedDuration,
                );
                dispatch({
                    type: "ALLOCATE_TIME_TO_MODULE",
                    payload: {
                        moduleId,
                        curriculumId,
                        duration: allocatedDuration,
                    },
                });
            }, `Failed to allocate time to module (ID: ${moduleId}):`);
        },
        [dispatch],
    );

    return {
        createModule,
        updateModule,
        deleteModule,
        linkModuleToSyllabus,
        unlinkModuleToSyllabus,
        allocateTimeToModule,
    } as const;
}
