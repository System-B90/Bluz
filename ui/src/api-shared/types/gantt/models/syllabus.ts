import { GanttModuleId } from "@/api-shared/types/gantt/models/module";
import { BaseGantItem } from "@/api-shared/types/gantt/models/shared";

export type GanttSyllabus = {
    title: string;
    hiveIds: Array<number>;
    modules: Array<GanttModuleId>;
    /**
     * Student group ("shuffle") names for this syllabus (e.g. "ניצה", "לחם").
     * Empty/undefined ⇒ the syllabus has a single, unnamed group.
     */
    shuffles?: Array<string>;
} & BaseGantItem;
export type GanttSyllabusId = GanttSyllabus["id"];
