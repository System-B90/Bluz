import { useCallback } from "react";

import { curriculumApi } from "@/api-client/gant/api";
import { CurriculumId, Curriculum } from "@/api-shared/types/gant/curriculum";
import { withGantErrorHandling } from "@/components/gant/state/hooks/gant-funcs/WithGantErrorHandling";
import { useCurriculumProviderActions } from "@/components/gant/state/provider";

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
