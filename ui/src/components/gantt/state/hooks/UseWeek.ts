import {
    GanttCurriculumId,
    GanttWeek,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";
import { useCurriculumState } from "@/components/gantt/state/provider";

export function useCurriculumWeek(weekId: null): undefined;
export function useCurriculumWeek(
  weekId: GanttWeekId,
):
  | (GanttWeek & { id: GanttWeekId; curriculumId: GanttCurriculumId })
  | undefined;
export function useCurriculumWeek(
    weekId: GanttWeekId | null,
):
  | (GanttWeek & { id: GanttWeekId; curriculumId: GanttCurriculumId })
  | undefined {
    const state = useCurriculumState();

    if (weekId === null) {
        return undefined;
    }

    return state.weeks[weekId];
}
