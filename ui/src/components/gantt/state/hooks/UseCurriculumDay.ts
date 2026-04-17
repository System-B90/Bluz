import { CurriculumDay, CurriculumDayId, CurriculumWeekId } from "@/api-shared/types/gantt/curriculum";
import { useCurriculumState } from "@/components/gantt/state/provider";

export function useCurriculumDay(dayId: null): undefined;
export function useCurriculumDay(dayId: CurriculumDayId): (CurriculumDay & { id: CurriculumDayId; weekId: CurriculumWeekId; }) | undefined;
export function useCurriculumDay(dayId: CurriculumDayId | null): (CurriculumDay & { id: CurriculumDayId; weekId: CurriculumWeekId; }) | undefined
{
    const state = useCurriculumState();

    if (dayId === null)
    {
        return undefined;
    }

    return state.days[ dayId ];
}
