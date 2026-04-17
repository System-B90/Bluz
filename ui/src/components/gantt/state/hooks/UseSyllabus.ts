import { SyllabusDocument } from "@/api-client/gantt/syllabus";
import { GanttSyllabusId } from "@/api-shared/types/gantt/curriculum";
import { useCurriculumState } from "@/components/gantt/state/provider";

export function useSyllabus(syllabusId: null): undefined;
export function useSyllabus(syllabusId: GanttSyllabusId): SyllabusDocument | undefined;
export function useSyllabus(syllabusId: null | GanttSyllabusId): SyllabusDocument | undefined
{
    const state = useCurriculumState();

    if (syllabusId === null)
    {
        return undefined;
    }

    return state.syllabuses[ syllabusId ];
}
