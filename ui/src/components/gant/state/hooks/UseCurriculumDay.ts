import { CurriculumDay, CurriculumDayId, CurriculumWeekId } from "@/api-shared/types/gant/curriculum";
import { useCurriculumState } from "@/components/gant/state/provider";

export function useCurriculumDay(dayId: null): undefined;
export function useCurriculumDay(dayId: CurriculumDayId): (CurriculumDay & { id: CurriculumDayId; curriculumWeekId: CurriculumWeekId; }) | undefined;
export function useCurriculumDay(dayId: null | CurriculumDayId): (CurriculumDay & { id: CurriculumDayId; curriculumWeekId: CurriculumWeekId; }) | undefined
{
    const state = useCurriculumState();

    if (dayId === null)
    {
        return undefined;
    }

    return state.days[ dayId ];
}
