import {
    GanttConstraint,
    GanttCurriculumId,
    GanttWeek,
} from "@/api-shared/types/gantt/models";

export type GanttConstraintState = {
    constraints: Record<string, GanttConstraint>;
    isLoading: boolean;
};

export type GanttContextType = {
    weeklyView: boolean;
    startDate: null | string;
    timelineWeeks: Array<GanttWeek>;
    linearDays: Array<string>;
    eventMappings: Record<string, string>;
    moduleMappings: Record<string, Array<string>>;
    violations: Record<string, Array<string>>;
    onMapModule: (moduleId: string, dayId: string) => Promise<void>;
    onMapEvent: (
        moduleId: string,
        eventId: string,
        dayId: string,
    ) => Promise<void>;
    onMoveEvent: (
        moduleId: string,
        eventId: string,
        sourceDayId: string,
        targetDayId: string,
    ) => Promise<void>;
    onMoveModule: (
        moduleId: string,
        sourceDayId: string,
        targetDayId: string,
    ) => Promise<void>;
    onShiftModule: (moduleId: string, deltaDays: number) => Promise<void>;
};

export type GanttViewProps = {
    curriculumId: GanttCurriculumId;
};

export type SpanVariant = "end" | "middle" | "none" | "single" | "start";

export type GanttBlockProps = {
    id: string;
    payload: any;
    title?: string;
    isOpaque?: boolean;
    spanLength?: number;
    isAbsolute?: boolean;
    elementId?: string;
    violations?: Array<string>;
    blockLeftPx?: number;
    blockWidthPx?: number;
};

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
    blockLeftPx?: number;
    blockWidthPx?: number;
};

export type GanttModuleRowProps = {
    moduleId: string;
};

export type GanttEventRowProps = {
    eventId: string;
    moduleId: string;
};

export type GanttSyllabusGroupProps = {
    syllabusId: string;
};

export type ConstraintLink = {
    id: string;
    sourceId: string;
    targetId: string;
    isViolated: boolean;
};
