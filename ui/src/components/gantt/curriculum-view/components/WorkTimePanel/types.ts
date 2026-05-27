import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

export type WorkTimePanelProps = {
  curriculumId: GanttCurriculumId | null;
  curriculum: GanttCurriculumDocument | undefined;
};
