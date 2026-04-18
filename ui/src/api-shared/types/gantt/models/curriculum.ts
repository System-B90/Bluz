import { BaseGantItem } from "@/api-shared/types/gantt/models/shared";
import { GanttSyllabusId } from "@/api-shared/types/gantt/models/syllabus";
import { GanttWeekId } from "@/api-shared/types/gantt/models/week";

export interface GanttCurriculum extends BaseGantItem {
  title: string;
  description: string;
  syllabuses: Array<GanttSyllabusId>;
  isDraft: boolean;
  weeks: Array<GanttWeekId>;
}
export type GanttCurriculumId = GanttCurriculum["id"];
