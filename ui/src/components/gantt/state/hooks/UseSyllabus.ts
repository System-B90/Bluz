import { SyllabusDocument } from "@/api-client/gantt/syllabus";
import { GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { useCurriculumState } from "@/components/gantt/state/context";

export function useSyllabus(syllabusId: null): undefined;
export function useSyllabus(
    syllabusId: GanttSyllabusId,
): SyllabusDocument | undefined;
export function useSyllabus(
    syllabusId: GanttSyllabusId | null,
): SyllabusDocument | undefined {
    const state = useCurriculumState();

    if (syllabusId === null) {
        return undefined;
    }

    return state.syllabuses[syllabusId];
}
