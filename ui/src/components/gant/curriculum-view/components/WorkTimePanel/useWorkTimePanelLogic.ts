import { Dispatch, KeyboardEvent, SetStateAction, useCallback } from 'react';

import { CurriculumId, CurriculumWeek } from '@/api-shared/types/gant/curriculum';
import { buildDefaultWeekDays } from '@/components/gant/curriculum-view/components/WorkTimePanel/defaults';
import { cloneWeeks, pickNextDay } from '@/components/gant/curriculum-view/components/WorkTimePanel/utils';
import { useCurriculumActions } from '@/components/gant/state/hooks/gant-funcs/UseCurriculumActions';

export function useWorkTimePanelLogic(
    curriculumId: CurriculumId | null,
    curriculumWeeks: CurriculumWeek[],
    localWeeks: CurriculumWeek[],
    setLocalWeeks: Dispatch<SetStateAction<CurriculumWeek[]>>
)
{
    const { updateCurriculum } = useCurriculumActions();

    const persistWeeks = useCallback(async (updatedWeeks: CurriculumWeek[]) =>
    {
        if (!curriculumId) return;
        setLocalWeeks(updatedWeeks);
        await updateCurriculum(curriculumId, { weeks: updatedWeeks });
    }, [ curriculumId, setLocalWeeks, updateCurriculum ]);

    const updateWeeksLocally = useCallback((updater: (weeks: CurriculumWeek[]) => CurriculumWeek[]) =>
    {
        setLocalWeeks((prev) => updater(cloneWeeks(prev)));
    }, [ setLocalWeeks ]);

    const saveDayHours = useCallback(async (weekIndex: number, dayIndex: number) =>
    {
        const original = curriculumWeeks[ weekIndex ]?.days[ dayIndex ]?.totalWorkingHours;
        const edited = localWeeks[ weekIndex ]?.days[ dayIndex ]?.totalWorkingHours;
        if (original === undefined || edited === undefined || original === edited) return;
        await persistWeeks(cloneWeeks(localWeeks));
    }, [ curriculumWeeks, localWeeks, persistWeeks ]);

    const saveDayComment = useCallback(async (weekIndex: number, dayIndex: number) =>
    {
        const original = curriculumWeeks[ weekIndex ]?.days[ dayIndex ]?.comment ?? '';
        const edited = localWeeks[ weekIndex ]?.days[ dayIndex ]?.comment ?? '';
        if (original === edited) return;
        await persistWeeks(cloneWeeks(localWeeks));
    }, [ curriculumWeeks, localWeeks, persistWeeks ]);

    const saveWeekComment = useCallback(async (weekIndex: number) =>
    {
        const original = curriculumWeeks[ weekIndex ]?.comment ?? '';
        const edited = localWeeks[ weekIndex ]?.comment ?? '';
        if (original === edited) return;
        await persistWeeks(cloneWeeks(localWeeks));
    }, [ curriculumWeeks, localWeeks, persistWeeks ]);

    const onHoursKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>, weekIndex: number, dayIndex: number) =>
    {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        void saveDayHours(weekIndex, dayIndex);
    }, [ saveDayHours ]);

    const onWeekCommentKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>, weekIndex: number) =>
    {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        void saveWeekComment(weekIndex);
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
