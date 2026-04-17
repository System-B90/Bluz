import { CurriculumId, CurriculumWeek, CurriculumWeekId } from "@/api-shared/types/gantt/curriculum";
import { useCurriculumState } from "@/components/gantt/state/provider";

export function useCurriculumWeek(weekId: null): undefined;
export function useCurriculumWeek(weekId: CurriculumWeekId): (CurriculumWeek & { id: CurriculumWeekId; curriculumId: CurriculumId; }) | undefined;
export function useCurriculumWeek(weekId: CurriculumWeekId | null): (CurriculumWeek & { id: CurriculumWeekId; curriculumId: CurriculumId; }) | undefined
{
    const state = useCurriculumState();

    if (weekId === null)
    {
        return undefined;
    }

    return state.weeks[ weekId ];
}
