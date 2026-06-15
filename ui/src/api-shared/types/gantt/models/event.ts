import { GanttConstraint } from "@/api-shared/types/gantt/models/constraint";
import { BaseGantItem } from "@/api-shared/types/gantt/models/shared";

export enum ModuleEventType {
    Lecture = "הרצאה",
    Exercise = 'ע"ע',
    SelfTeaching = 'ל"ע',
    Other = "אחר",
}

export type GanttEvent = {
    title: string;
    type: ModuleEventType;
    minimumDuration: number;
    allocatedDuration: number;
    constraints: Array<GanttConstraint>;
} & BaseGantItem;
export type GanttEventId = GanttEvent["id"];
