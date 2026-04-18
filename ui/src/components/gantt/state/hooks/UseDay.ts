import
{
    GanttDay,
    GanttDayId,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";
import { useCurriculumState } from "@/components/gantt/state/provider";

export function useCurriculumDay(dayId: null): undefined;
export function useCurriculumDay(
  dayId: GanttDayId,
): (GanttDay & { id: GanttDayId; weekId: GanttWeekId }) | undefined;
export function useCurriculumDay(
    dayId: GanttDayId | null,
): (GanttDay & { id: GanttDayId; weekId: GanttWeekId }) | undefined {
    const state = useCurriculumState();

    if (dayId === null) {
        return undefined;
    }

    return state.days[dayId];
}
