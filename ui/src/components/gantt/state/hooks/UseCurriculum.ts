import { CurriculumDocument } from "@/api-client/gantt/curriculum";
import { CurriculumId } from "@/api-shared/types/gantt/curriculum";
import { useCurriculumState } from "@/components/gantt/state/provider";

export function useCurriculum(curriculumId: null): undefined;
export function useCurriculum(curriculumId: CurriculumId): CurriculumDocument | undefined;
export function useCurriculum(curriculumId: CurriculumId | null): CurriculumDocument | undefined
{
    const state = useCurriculumState();

    if (curriculumId === null)
    {
        return undefined;
    }

    return state.curriculums[ curriculumId ];
}
