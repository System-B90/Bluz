import { Course, CourseId } from "@/api-shared/types/course";

type TitledSyllabus = {
    id: string;
    title: string;
    courseIds?: Array<CourseId>;
};

/**
 * Display titles for syllabuses. A title shared by several syllabuses gets its
 * course names in brackets ("דמות (אפולו)"), so namesakes stay distinguishable.
 * Unique titles, and syllabuses without a known course, keep the bare title.
 */
export function disambiguatedSyllabusTitles(
    syllabuses: Iterable<TitledSyllabus>,
    getCourse: (id: CourseId) => Course | undefined,
): Record<string, string> {
    const list = [...syllabuses];
    const counts = new Map<string, number>();
    for (const { title } of list) {
        counts.set(title, (counts.get(title) ?? 0) + 1);
    }

    const titles: Record<string, string> = {};
    for (const { id, title, courseIds } of list) {
        const courseNames = (courseIds ?? [])
            .map((courseId) => getCourse(courseId)?.name)
            .filter((name): name is string => Boolean(name));
        titles[id] =
            (counts.get(title) ?? 0) > 1 && courseNames.length > 0
                ? `${title} (${courseNames.join(", ")})`
                : title;
    }
    return titles;
}
