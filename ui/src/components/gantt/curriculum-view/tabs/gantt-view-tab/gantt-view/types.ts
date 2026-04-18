import { GanttCurriculumId, GanttWeek } from '@/api-shared/types/gantt/models';

export interface IGanttContext
{
    timelineWeeks: GanttWeek[];
    linearDays: string[];
    eventMappings: Record<string, string>; // eventId -> dayId
    moduleMappings: Record<string, string[]>; // moduleId -> dayId[]
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