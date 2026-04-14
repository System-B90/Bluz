import { curriculumApi } from "@/api-client/gant/api";
import { CurriculumId, CurriculumWeek } from "@/api-shared/types/gant/curriculum";
import { withGantErrorHandling } from "@/components/gant/state/hooks/gant-funcs/WithGantErrorHandling";
import { useCurriculumProviderActions } from "@/components/gant/state/provider";
import { useCallback } from "react";

export function useWeekActions()
{
    const { dispatch } = useCurriculumProviderActions();

    const updateWeek = useCallback(async (id: CurriculumId, weekIndex: number, updates: Partial<CurriculumWeek>) =>
    {
        return withGantErrorHandling(async () =>
        {
            const updatedCurriculum = await curriculumApi.apiUpdate({ id,  });
            dispatch({ type: 'UPDATE_CURRICULUM', payload: { id, updates: updatedCurriculum } });
            return updatedCurriculum;
        }, `Failed to update curriculum (ID: ${id}):`);
    }, [ dispatch ]);

    return { updateWeek } as const;
}
