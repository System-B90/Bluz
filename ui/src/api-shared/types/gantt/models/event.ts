import { GanttConstraint } from "@/api-shared/types/gantt/models/constraint";
import { BaseGantItem } from "@/api-shared/types/gantt/models/shared";

export enum ModuleEventType
{
  Lecture = "הרצאה",
  Exercise = 'ע"ע',
  SelfTeaching = 'ל"ע',
  Other = "אחר",
}

export interface GanttEvent extends BaseGantItem
{
  title: string;
  type: ModuleEventType;
  minimumDuration: number;
  allocatedDuration: number;
  constraints: Array<GanttConstraint>;
}
export type GanttEventId = GanttEvent[ "id" ];
