import { useCallback } from "react";

import { curriculumApi } from "@/api-client/gant/api";
import { CurriculumDay, CurriculumId, CurriculumWeek } from "@/api-shared/types/gant/curriculum";
import { withGantErrorHandling } from "@/components/gant/state/hooks/gant-funcs/WithGantErrorHandling";
import { useCurriculumProviderActions, useCurriculumState } from "@/components/gant/state/provider";

export function useWeekActions()
{
    const state = useCurriculumState();
    const { dispatch } = useCurriculumProviderActions();

    const updateWeek = useCallback(async (curriculumId: CurriculumId, weekIndex: number, updates: Partial<CurriculumWeek>) =>
    {
        return withGantErrorHandling(async () =>
        {
            const data = state.curriculums[ curriculumId ].weeks;
            data[ weekIndex ] = { ...data[ weekIndex ], ...updates };
            const updatedCurriculum = await curriculumApi.apiUpdate({ id: curriculumId, weeks: data });
            dispatch({ type: 'UPDATE_CURRICULUM', payload: { id: curriculumId, updates: updatedCurriculum } });
            return updatedCurriculum;
        }, `Failed to update curriculum (ID: ${curriculumId}):`);
    }, [ state, dispatch ]);

    const updateDay = useCallback(async (curriculumId: CurriculumId, weekIndex: number, dayIndex: number, updates: Partial<CurriculumDay>) =>
    {
        return withGantErrorHandling(async () =>
        {
            const data = state.curriculums[ curriculumId ].weeks;
            data[ weekIndex ].days[ dayIndex ] = { ...data[ weekIndex ].days[ dayIndex ], ...updates };
            dispatch({ type: 'UPDATE_CURRICULUM', payload: { id: curriculumId, updates: { weeks: data } } });
            const updatedCurriculum = await curriculumApi.apiUpdate({ id: curriculumId, weeks: data });
            return updatedCurriculum;
        }, `Failed to update curriculum (ID: ${curriculumId}):`);
    }, [ state, dispatch ]);

    return { updateWeek, updateDay } as const;
}
