import { GanttCurriculumId, GanttDayIndex, GanttWeek } from '@/api-shared/types/gantt/models';

export enum ConstraintType
{
    Relational = "RELATIONAL",
    Temporal = "TEMPORAL"
}

export type EntityType = "event" | "module";

export type RelationalConstraint = {
    id: string;
    type: ConstraintType.Relational;
    targetId: string;
    targetType: EntityType;
    relation: "after" | "before";
    minDelayDays?: number;
    maxDelayDays?: number;
}

export type TemporalConstraint = {
    id: string;
    type: ConstraintType.Temporal;
    allowedDays?: Array<GanttDayIndex>;
    forbiddenDays?: Array<GanttDayIndex>;
}

export type GanttConstraint = RelationalConstraint | TemporalConstraint;

export type GanttConstraintState = {
    constraints: Record<string, GanttConstraint>;
    isLoading: boolean;
}

export type IGanttContext = {
    timelineWeeks: Array<GanttWeek>;
    linearDays: Array<string>;
    eventMappings: Record<string, string>;
    moduleMappings: Record<string, Array<string>>;
    violations: Record<string, Array<string>>;
    onMapModule: (moduleId: string, dayId: string) => Promise<void>;
    onMapEvent: (moduleId: string, eventId: string, dayId: string) => Promise<void>;
    onMoveEvent: (moduleId: string, eventId: string, sourceDayId: string, targetDayId: string) => Promise<void>;
    onMoveModule: (moduleId: string, sourceDayId: string, targetDayId: string) => Promise<void>;
    onShiftModule: (moduleId: string, deltaDays: number) => Promise<void>;
}

export type GanttViewProps = {
    curriculumId: GanttCurriculumId;
}

export type SpanVariant = 'end' | 'middle' | 'none' | 'single' | 'start';

export type GanttBlockProps = {
    id: string;
    payload: any;
    title?: string;
    isOpaque?: boolean;
    spanLength?: number;
    isAbsolute?: boolean;
    elementId?: string;
    violations?: Array<string>;
}

export type GanttCellProps = {
    dayId: string;
    dropId: string;
    payloadData: any;
    hasBlock?: boolean;
    blockId?: string;
    blockPayload?: any;
    blockTitle?: string;
    spanLength?: number;
    isOpaque?: boolean;
    isAbsoluteBlock?: boolean;
    elementId?: string;
    violations?: Array<string>;
}

export type GanttModuleRowProps = {
    moduleId: string;
}

export type GanttEventRowProps = {
    eventId: string;
    moduleId: string;
}

export type GanttSyllabusGroupProps = {
    syllabusId: string;
}

export type ConstraintLink = {
    id: string;
    sourceId: string;
    targetId: string;
    isViolated: boolean;
}
