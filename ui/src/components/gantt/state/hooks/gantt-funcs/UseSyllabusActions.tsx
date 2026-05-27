import { useCallback } from "react";

import { ganttApi } from "@/api-client/gantt";
import {
    GanttCurriculumId,
    GanttSyllabus,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { withGantErrorHandling } from "@/components/gantt/state/hooks/gantt-funcs/WithGantErrorHandling";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

export function useSyllabusActions() {
    const { dispatch } = useCurriculumProviderActions();

    const createSyllabus = useCallback(
        async (
            title: string,
            curriculumId: GanttCurriculumId,
            hiveIds: Array<number> = [],
        ) => {
            return await withGantErrorHandling(async () => {
                const newSyllabus = await ganttApi.syllabus.apiCreate({
                    title,
                    curriculumId,
                    hiveIds,
                });
                dispatch({
                    type: "ADD_SYLLABUS",
                    payload: { syllabus: newSyllabus, curriculumId },
                });
                return newSyllabus;
            }, "Failed to create syllabus:");
        },
        [dispatch],
    );

    const updateSyllabus = useCallback(
        async (id: GanttSyllabusId, updates: Partial<GanttSyllabus>) => {
            return await withGantErrorHandling(async () => {
                const updatedSyllabus = await ganttApi.syllabus.apiUpdate({
                    id,
                    ...updates,
                });
                dispatch({
                    type: "UPDATE_SYLLABUS",
                    payload: { id, updates: updatedSyllabus },
                });
                return updatedSyllabus;
            }, `Failed to update syllabus (ID: ${id}):`);
        },
        [dispatch],
    );

    const deleteSyllabus = useCallback(
        async (curriculumId: GanttCurriculumId, syllabusId: GanttSyllabusId) => {
            return await withGantErrorHandling(async () => {
                await ganttApi.syllabus.apiDelete(syllabusId);
                dispatch({
                    type: "REMOVE_SYLLABUS",
                    payload: { curriculumId, syllabusId },
                });
            }, `Failed to remove syllabus (ID: ${syllabusId}):`);
        },
        [dispatch],
    );

    const linkSyllabusToCurriculum = useCallback(
        async (curriculumId: GanttCurriculumId, syllabusId: GanttSyllabusId) => {
            return await withGantErrorHandling(async () => {
                const linkedSyllabus = await ganttApi.syllabus.apiLink(
                    syllabusId,
                    curriculumId,
                );
                dispatch({
                    type: "ADD_SYLLABUS",
                    payload: { syllabus: linkedSyllabus, curriculumId },
                });
                return linkedSyllabus;
            }, `Failed to link syllabus (ID: ${syllabusId}) to curriculum (ID: ${curriculumId}):`);
        },
        [dispatch],
    );

    const unlinkSyllabusFromCurriculum = useCallback(
        async (curriculumId: GanttCurriculumId, syllabusId: GanttSyllabusId) => {
            return await withGantErrorHandling(async () => {
                await ganttApi.syllabus.apiUnlink(syllabusId, curriculumId);
                dispatch({
                    type: "REMOVE_SYLLABUS",
                    payload: { syllabusId, curriculumId },
                });
            }, `Failed to unlink syllabus (ID: ${syllabusId}) from curriculum (ID: ${curriculumId}):`);
        },
        [dispatch],
    );

    return {
        createSyllabus,
        updateSyllabus,
        deleteSyllabus,
        linkSyllabusToCurriculum,
        unlinkSyllabusFromCurriculum,
    } as const;
}
