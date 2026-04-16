import { CurriculumId, CurriculumWeek, CurriculumWeekId } from "@/api-shared/types/gant/curriculum";
import { useCurriculumState } from "@/components/gant/state/provider";

export function useCurriculumWeek(weekId: null): undefined;
export function useCurriculumWeek(weekId: CurriculumWeekId): (CurriculumWeek & { id: CurriculumWeekId; curriculumId: CurriculumId; }) | undefined;
export function useCurriculumWeek(weekId: null | CurriculumWeekId): (CurriculumWeek & { id: CurriculumWeekId; curriculumId: CurriculumId; }) | undefined
{
    const state = useCurriculumState();

    if (weekId === null)
    {
        return undefined;
    }

    return state.weeks[ weekId ];
}
