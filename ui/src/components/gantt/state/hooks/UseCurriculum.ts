import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models/curriculum";
import { useCurriculumState } from "@/components/gantt/state/provider";

export function useCurriculum(curriculumId: null): undefined;
export function useCurriculum(curriculumId: GanttCurriculumId): GanttCurriculumDocument | undefined;
export function useCurriculum(curriculumId: GanttCurriculumId | null): GanttCurriculumDocument | undefined
{
    const state = useCurriculumState();

    if (curriculumId === null)
    {
        return undefined;
    }

    return state.curriculums[ curriculumId ];
}
