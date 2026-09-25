import { useCallback } from "react";

import { ganttApi } from "@/api-client/gantt";
import {
    GanttCurriculum,
    GanttCurriculumId,
} from "@/api-shared/types/gantt/models";
import { useCurriculumProviderActions } from "@/components/gantt/state/context";
import { withGantErrorHandling } from "@/components/gantt/state/hooks/gantt-funcs/WithGantErrorHandling";

export function useCurriculumActions() {
    const { dispatch } = useCurriculumProviderActions();

    const updateCurriculum = useCallback(
        async (id: GanttCurriculumId, updates: Partial<GanttCurriculum>) => {
            return await withGantErrorHandling(async () => {
                const updatedCurriculum = await ganttApi.curriculum.apiUpdate({
                    id,
                    ...updates,
                });
                dispatch({
                    type: "UPDATE_CURRICULUM",
                    payload: { id, updates: updatedCurriculum },
                });
                return updatedCurriculum;
            }, `Failed to update curriculum (ID: ${id}):`);
        },
        [dispatch],
    );

    return { updateCurriculum } as const;
}
