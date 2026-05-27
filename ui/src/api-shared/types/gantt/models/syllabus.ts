import { GanttModuleId } from "@/api-shared/types/gantt/models/module";
import { BaseGantItem } from "@/api-shared/types/gantt/models/shared";

export type GanttSyllabus = {
  title: string;
  hiveIds: Array<number>;
  modules: Array<GanttModuleId>;
} & BaseGantItem;
export type GanttSyllabusId = GanttSyllabus["id"];
