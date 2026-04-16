import { useCallback } from "react";

import { curriculumApi } from "@/api-client/gant/api";
import { CurriculumDay, CurriculumDayId, CurriculumWeekId } from "@/api-shared/types/gant/curriculum";
import { withGantErrorHandling } from "@/components/gant/state/hooks/gant-funcs/WithGantErrorHandling";
import { useCurriculumProviderActions, useCurriculumState } from "@/components/gant/state/provider";

export function useWeekActions()
{
    const state = useCurriculumState();
    const { dispatch } = useCurriculumProviderActions();

    const updateWeek = useCallback(async (weekId: CurriculumWeekId, updates: Partial<{ comment?: string; closingSaturday?: boolean; }>) =>
    {
        return withGantErrorHandling(async () =>
        {
            const week = state.weeks[weekId];
            if (!week) throw new Error(`Week not found: ${weekId}`);
            
            const curriculumId = week.curriculumId;
            const curriculum = state.curriculums[curriculumId];
            if (!curriculum) throw new Error(`Curriculum not found: ${curriculumId}`);
            
            // Update local state
            const updatedWeek = { ...week, ...updates };
            dispatch({ type: 'UPDATE_WEEK', payload: { id: weekId, updates } });
            
            // Update via API
            const updatedCurriculum = await curriculumApi.apiUpdate({ 
                id: curriculumId, 
                weeks: curriculum.weeks 
            });
            dispatch({ type: 'UPDATE_CURRICULUM', payload: { id: curriculumId, updates: updatedCurriculum } });
            return updatedCurriculum;
        }, `Failed to update week (ID: ${weekId}):`);
    }, [ state, dispatch ]);

    const updateDay = useCallback(async (dayId: CurriculumDayId, updates: Partial<CurriculumDay>) =>
    {
        return withGantErrorHandling(async () =>
        {
            const day = state.days[dayId];
            if (!day) throw new Error(`Day not found: ${dayId}`);
            
            const week = state.weeks[day.curriculumWeekId];
            if (!week) throw new Error(`Week not found: ${day.curriculumWeekId}`);
            
            const curriculum = state.curriculums[week.curriculumId];
            if (!curriculum) throw new Error(`Curriculum not found: ${week.curriculumId}`);
            
            // Update local state
            dispatch({ type: 'UPDATE_DAY', payload: { id: dayId, updates } });
            
            // Update via API
            const updatedCurriculum = await curriculumApi.apiUpdate({ 
                id: curriculum.id, 
                weeks: curriculum.weeks 
            });
            dispatch({ type: 'UPDATE_CURRICULUM', payload: { id: curriculum.id, updates: updatedCurriculum } });
            return updatedCurriculum;
        }, [ state, dispatch ]);
    }, [ state, dispatch ]);

    const updateWeekDays = useCallback(async (weekId: CurriculumWeekId, updates: Partial<{ closingSaturday?: boolean; dayIds?: CurriculumDayId[]; }>) =>
    {
        return withGantErrorHandling(async () =>
        {
            const week = state.weeks[weekId];
            if (!week) throw new Error(`Week not found: ${weekId}`);
            
            const curriculum = state.curriculums[week.curriculumId];
            if (!curriculum) throw new Error(`Curriculum not found: ${week.curriculumId}`);
            
            // Update local state
            dispatch({ type: 'UPDATE_WEEK', payload: { id: weekId, updates } });
            
            // Update via API
            const updatedCurriculum = await curriculumApi.apiUpdate({ 
                id: curriculum.id, 
                weeks: curriculum.weeks 
            });
            dispatch({ type: 'UPDATE_CURRICULUM', payload: { id: curriculum.id, updates: updatedCurriculum } });
            return updatedCurriculum;
        }, [ state, dispatch ]);
    }, [ state, dispatch ]);

    return { updateWeek, updateDay, updateWeekDays } as const;
}
