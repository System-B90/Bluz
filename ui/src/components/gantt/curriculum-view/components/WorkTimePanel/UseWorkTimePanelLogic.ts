import { Dispatch, KeyboardEvent, SetStateAction, useCallback } from 'react';

import { CurriculumId, CurriculumWeekId } from '@/api-shared/types/gantt/curriculum';
import { buildDefaultWeekDays } from '@/components/gantt/curriculum-view/components/WorkTimePanel/defaults';
import { cloneWeeks, pickNextDay } from '@/components/gantt/curriculum-view/components/WorkTimePanel/utils';
import { useCurriculumActions } from '@/components/gantt/state/hooks/gantt-funcs/UseCurriculumActions';

export function useWorkTimePanelLogic(
    curriculumId: CurriculumId | null,
    curriculumWeekIds: CurriculumWeekId[],
    localWeekIds: CurriculumWeekId[],
    setLocalWeekIds: Dispatch<SetStateAction<CurriculumWeekId[]>>
)
{
    const { updateCurriculum } = useCurriculumActions();

    const persistWeeks = useCallback(async (updatedWeekIds: CurriculumWeekId[]) =>
    {
        if (!curriculumId) return;
        setLocalWeekIds(updatedWeekIds);
        await updateCurriculum(curriculumId, { weeks: updatedWeekIds });
    }, [ curriculumId, setLocalWeekIds, updateCurriculum ]);

    const updateWeeksLocally = useCallback((updater: (weekIds: CurriculumWeekId[]) => CurriculumWeekId[]) =>
    {
        setLocalWeekIds((prev) => updater(cloneWeeks(prev)));
    }, [ setLocalWeekIds ]);

    const saveDayHours = useCallback(async () =>
    {
        // With normalized store, changes are tracked separately for each day
        // This is called when user updates day hours
        await persistWeeks(cloneWeeks(localWeekIds));
    }, [ localWeekIds, persistWeeks ]);

    const saveDayComment = useCallback(async () =>
    {
        // With normalized store, changes are tracked separately for each day
        // This is called when user updates day comment
        await persistWeeks(cloneWeeks(localWeekIds));
    }, [ localWeekIds, persistWeeks ]);

    const saveWeekComment = useCallback(async () =>
    {
        // With normalized store, changes are tracked separately for each week
        // This is called when user updates week comment
        await persistWeeks(cloneWeeks(localWeekIds));
    }, [ localWeekIds, persistWeeks ]);

    const onHoursKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) =>
    {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        void saveDayHours();
    }, [ saveDayHours ]);

    const onWeekCommentKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) =>
    {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        void saveWeekComment();
    }, [ saveWeekComment ]);

    return {
        updateWeeksLocally,
        persistWeeks,
        saveDayHours,
        saveDayComment,
        saveWeekComment,
        onHoursKeyDown,
        onWeekCommentKeyDown,
        pickNextDay,
        buildDefaultWeekDays,
    };
}
