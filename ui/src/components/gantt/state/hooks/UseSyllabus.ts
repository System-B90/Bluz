import { SyllabusDocument } from "@/api-client/gantt/syllabus";
import { SyllabusId } from "@/api-shared/types/gantt/curriculum";
import { useCurriculumState } from "@/components/gantt/state/provider";

export function useSyllabus(syllabusId: null): undefined;
export function useSyllabus(syllabusId: SyllabusId): SyllabusDocument | undefined;
export function useSyllabus(syllabusId: null | SyllabusId): SyllabusDocument | undefined
{
    const state = useCurriculumState();

    if (syllabusId === null)
    {
        return undefined;
    }

    return state.syllabuses[ syllabusId ];
}
