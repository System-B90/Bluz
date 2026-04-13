import { CurriculumDocument } from "@/api-client/gant/curriculum";
import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import { useCurriculumState } from "@/components/gant/state/provider";

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
