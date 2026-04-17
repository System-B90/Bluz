import { useCallback } from "react";

import { curriculumApi } from "@/api-client/gantt";
import { GanttCurriculum, GanttCurriculumId } from "@/api-shared/types/gantt/curriculum";
import { withGantErrorHandling } from "@/components/gantt/state/hooks/gantt-funcs/WithGantErrorHandling";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

export function useCurriculumActions()
{
    const { dispatch } = useCurriculumProviderActions();

    const updateCurriculum = useCallback(async (id: GanttCurriculumId, updates: Partial<GanttCurriculum>) =>
    {
        return withGantErrorHandling(async () =>
        {
            const updatedCurriculum = await curriculumApi.apiUpdate({ id, ...updates });
            dispatch({ type: 'UPDATE_CURRICULUM', payload: { id, updates: updatedCurriculum } });
            return updatedCurriculum;
        }, `Failed to update curriculum (ID: ${id}):`);
    }, [ dispatch ]);

    return { updateCurriculum } as const;
}
