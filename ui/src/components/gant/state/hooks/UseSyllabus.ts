import { SyllabusDocument } from "@/api-client/gant/syllabus";
import { SyllabusId } from "@/api-shared/types/gant/curriculum";
import { useCurriculumState } from "@/components/gant/state/provider";

export function useSyllabus(syllabusId: null): undefined;
export function useSyllabus(syllabusId: SyllabusId): SyllabusDocument | undefined;
export function useSyllabus(syllabusId: SyllabusId | null): SyllabusDocument | undefined
{
    const state = useCurriculumState();

    if (syllabusId === null)
    {
        return undefined;
    }

    return state.syllabuses[ syllabusId ];
}
