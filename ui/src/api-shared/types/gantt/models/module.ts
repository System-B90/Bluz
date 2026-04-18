import { GanttEventId } from "@/api-shared/types/gantt/models/event";
import { BaseGantItem } from "@/api-shared/types/gantt/models/shared";

export interface GanttModule extends BaseGantItem {
  title: string;
  description: string;
  events: Array<GanttEventId>;
  hiveIds: Array<number>;
}
export type GanttModuleId = GanttModule["id"];
