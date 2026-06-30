import { GanttConstraint } from "@/api-shared/types/gantt/models/constraint";
import { BaseGantItem } from "@/api-shared/types/gantt/models/shared";

export enum ModuleEventType {
    Lecture = "הרצאה",
    Exercise = 'ע"ע',
    SelfTeaching = 'ל"ע',
    Other = "אחר",
}

export enum RoomRequirement {
    Classified = "בחדר מסווג",
    Outside = "בחוץ",
    MultipleClassrooms = "כמה כיתות",
    OffBase = "מחוץ לבסיס",
    Online = "באופן מקוון",
}

export enum EventRecurrence {
    None = "none",
    Daily = "daily",
    Weekly = "weekly",
}

export type GanttEvent = {
    title: string;
    type: ModuleEventType;
    minimumDuration: number;
    allocatedDuration: number;
    /** Hive id of the responsible instructor ("אחראי"); null when unassigned. */
    orchestratorId: null | number;
    /** Outsider IDs, ordered by recommendation priority (top = most recommended). */
    recommendedLecturerIds: Array<string>;
    /** Free-text system requirements. */
    systemRequirements: Array<string>;
    roomRequirement: RoomRequirement;
    recurrence: EventRecurrence;
    /** Marked קריטי. */
    isCritical: boolean;
    /** Marked חלון פ"א. */
    isPaWindow: boolean;
    comment: null | string;
    constraints: Array<GanttConstraint>;
} & BaseGantItem;
export type GanttEventId = GanttEvent["id"];
