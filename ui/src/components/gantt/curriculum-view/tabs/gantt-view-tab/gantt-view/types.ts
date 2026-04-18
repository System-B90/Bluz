import { GanttCurriculumId, GanttWeek } from '@/api-shared/types/gantt/models';

export interface IGanttContext
{
    timelineWeeks: GanttWeek[];
    linearDays: string[];
    eventMappings: Record<string, string>; // eventId -> dayId
    moduleMappings: Record<string, string[]>; // moduleId -> dayId[]
    onMapModule: (moduleId: string, dayId: string) => void;
    onMoveEvent: (eventId: string, dayId: string) => void;
    onMoveModule: (moduleId: string, sourceDayId: string, targetDayId: string) => void;
}

export interface GanttViewProps
{
    curriculumId: GanttCurriculumId;
}

export interface GanttBlockProps
{
    id: string;
    payload: any;
    title?: string;
    isOpaque?: boolean;
}

export type SpanVariant = 'end' | 'middle' | 'none' | 'single' | 'start';

export interface GanttCellProps
{
    dayId: string;
    dropId: string;
    payloadData: any;
    hasBlock?: boolean;
    blockId?: string;
    blockPayload?: any;
    spanVariant?: SpanVariant;
    isOpaque?: boolean;
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
