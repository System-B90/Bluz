import { GanttDayIndex } from "@/api-shared/types/gantt/models";
import { ConstraintType } from "@/api-shared/types/gantt/models/constraint";

export type TargetOption = {
    id: string;
    label: string;
    title: string;
    type: "event" | "module";
    syllabusId: string;
};

export type RelationalDraft = {
    type: ConstraintType.Relational;
    targetId: string;
    targetType: "" | "event" | "module";
    relation: "after" | "before";
    minDelay?: string;
    maxDelay?: string;
};

export type TemporalDraft = {
    type: ConstraintType.Temporal;
    allowedDays: Array<GanttDayIndex>;
    forbiddenDays: Array<GanttDayIndex>;
};

export type DraftConstraint = RelationalDraft | TemporalDraft;
