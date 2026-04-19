import { GanttCurriculumId, GanttDayIndex, GanttWeek } from '@/api-shared/types/gantt/models';

export enum ConstraintType
{
    Relational = "RELATIONAL",
    Temporal = "TEMPORAL"
}

export type EntityType = "event" | "module";

export interface RelationalConstraint
{
    id: string;
    type: ConstraintType.Relational;
    targetId: string;
    targetType: EntityType;
    relation: "after" | "before";
    minDelayDays?: number;
    maxDelayDays?: number;
}

export interface TemporalConstraint
{
    id: string;
    type: ConstraintType.Temporal;
    allowedDays?: Array<GanttDayIndex>;
    forbiddenDays?: Array<GanttDayIndex>;
}

export type GanttConstraint = RelationalConstraint | TemporalConstraint;

export interface GanttConstraintState
{
    constraints: Record<string, GanttConstraint>;
    isLoading: boolean;
}

export interface IGanttContext
{
    timelineWeeks: GanttWeek[];
    linearDays: string[];
    eventMappings: Record<string, string>;
    moduleMappings: Record<string, string[]>;
    violations: Record<string, string[]>;
    onMapModule: (moduleId: string, dayId: string) => Promise<void>;
    onMapEvent: (moduleId: string, eventId: string, dayId: string) => Promise<void>;
    onMoveEvent: (moduleId: string, eventId: string, sourceDayId: string, targetDayId: string) => Promise<void>;
    onMoveModule: (moduleId: string, sourceDayId: string, targetDayId: string) => Promise<void>;
    onShiftModule: (moduleId: string, deltaDays: number) => Promise<void>;
}

export interface GanttViewProps
{
    curriculumId: GanttCurriculumId;
}

export type SpanVariant = 'start' | 'middle' | 'end' | 'single' | 'none';

export interface GanttBlockProps
{
    id: string;
    payload: any;
    title?: string;
    isOpaque?: boolean;
    spanLength?: number;
    isAbsolute?: boolean;
    elementId?: string;
    violations?: string[];
}

export interface GanttCellProps
{
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
    violations?: string[];
}

export interface GanttModuleRowProps
{
    moduleId: string;
}

export interface GanttEventRowProps
{
    eventId: string;
    moduleId: string;
}

export interface GanttSyllabusGroupProps
{
    syllabusId: string;
}

export interface ConstraintLink
{
    id: string;
    sourceId: string;
    targetId: string;
    isViolated: boolean;
}