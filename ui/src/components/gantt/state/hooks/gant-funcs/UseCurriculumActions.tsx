import { useCallback } from "react";

import { curriculumApi } from "@/api-client/gantt/api";
import { Curriculum, CurriculumId } from "@/api-shared/types/gantt/curriculum";
import { withGantErrorHandling } from "@/components/gantt/state/hooks/gant-funcs/WithGantErrorHandling";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

export function useCurriculumActions()
{
    const { dispatch } = useCurriculumProviderActions();

    const updateCurriculum = useCallback(async (id: CurriculumId, updates: Partial<Curriculum>) =>
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
