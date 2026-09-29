import { useMemo } from "react";

import { disambiguatedSyllabusTitles } from "@/api-shared/gantt/syllabus-titles";
import { GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { useCourses } from "@/components/base/CoursesProvider";
import { useCurriculumState } from "@/components/gantt/state/context";

/** Syllabus id → display title, course-qualified when the title is shared. */
export function useSyllabusTitles(): Record<GanttSyllabusId, string> {
    const { syllabuses } = useCurriculumState();
    const { getCourse } = useCourses();
    return useMemo(
        () => disambiguatedSyllabusTitles(Object.values(syllabuses), getCourse),
        [syllabuses, getCourse],
    );
}

export function useSyllabusTitle(
    syllabusId: GanttSyllabusId | null | undefined,
): string | undefined {
    const titles = useSyllabusTitles();
    return syllabusId ? titles[syllabusId] : undefined;
}
