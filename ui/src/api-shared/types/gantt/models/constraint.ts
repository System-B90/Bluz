import { GanttDayIndex } from "@/api-shared/types/gantt/models/day";
import { GanttEventId } from "@/api-shared/types/gantt/models/event";
import { GanttModuleId } from "@/api-shared/types/gantt/models/module";

export enum ConstraintType
{
    Relational = "RELATIONAL",
    Temporal = "TEMPORAL"
}

export type EntityType = "event" | "module";

export type BaseConstraint =
    {
        id: string;
        type: ConstraintType;
        ownerEventId: GanttEventId;
        ownerModuleId?: GanttModuleId | undefined;
        ownerType: 'event';
    } | {
        id: string;
        type: ConstraintType;
        ownerEventId?: GanttEventId | undefined;
        ownerModuleId: GanttModuleId;
        ownerType: 'module';
    };


/**
 * Handles dependencies between two entities (Event-Event, Module-Module, Mixed).
 */
export type RelationalConstraint = BaseConstraint &
{
    type: ConstraintType.Relational;
    targetId: GanttEventId | GanttModuleId; // ID of the referenced GanttEvent or GanttModule
    targetType: EntityType;
    relation: "after" | "before";
    minDelayDays?: number; // "at least N days after"
    maxDelayDays?: number; // "no more than N days after"
};

/**
 * Handles fixed calendar and day-of-week constraints.
 */
export type TemporalConstraint = BaseConstraint &
{
    type: ConstraintType.Temporal;
    allowedDays?: Array<GanttDayIndex>;   // e.g., "must be on Tuesday"
    forbiddenDays?: Array<GanttDayIndex>; // e.g., "must not be on Sunday"
};

export type GanttConstraint = RelationalConstraint | TemporalConstraint;
