import { CourseId } from "@/api-shared/types/course";
import { GanttModuleId } from "@/api-shared/types/gantt/models/module";
import { BaseGantItem } from "@/api-shared/types/gantt/models/shared";

export type GanttSyllabus = {
    title: string;
    /** Free text describing the syllabus, edited in the syllabus dialog. */
    description?: string;
    hiveIds: Array<number>;
    modules: Array<GanttModuleId>;
    /**
     * Student group ("shuffle") names for this syllabus (e.g. "ניצה", "לחם").
     * Empty/undefined ⇒ the syllabus has a single, unnamed group.
     */
    shuffles?: Array<string>;
    /** Courses (מסלולים) this syllabus belongs to. */
    courseIds?: Array<CourseId>;
    /** Hive ids of the אחראי מקצוע instructors. */
    leadInstructorIds?: Array<number>;
} & BaseGantItem;
export type GanttSyllabusId = GanttSyllabus["id"];
