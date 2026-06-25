import { BaseGantItem } from "@/api-shared/types/gantt/models/shared";
import { GanttSyllabusId } from "@/api-shared/types/gantt/models/syllabus";
import { GanttWeekId } from "@/api-shared/types/gantt/models/week";

export type GanttCurriculum = {
    title: string;
    description: string;
    startDate: null | string;
    syllabuses: Array<GanttSyllabusId>;
    isDraft: boolean;
    weeks: Array<GanttWeekId>;
} & BaseGantItem;
export type GanttCurriculumId = GanttCurriculum["id"];
