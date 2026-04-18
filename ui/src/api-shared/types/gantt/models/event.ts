import { GanttEventRequirements } from "@/api-shared/types/gantt/models/event-requirement";
import { BaseGantItem } from "@/api-shared/types/gantt/models/shared";

export enum ModuleEventType {
  Lecture = "הרצאה",
  Exercise = 'ע"ע',
  SelfTeaching = 'ל"ע',
  Other = "אחר",
}

export interface GanttEvent extends BaseGantItem {
  title: string;
  type: ModuleEventType;
  minimumDuration: number;
  allocatedDuration: number;
  requirements: Array<GanttEventRequirements>;
}
export type GanttEventId = GanttEvent["id"];
