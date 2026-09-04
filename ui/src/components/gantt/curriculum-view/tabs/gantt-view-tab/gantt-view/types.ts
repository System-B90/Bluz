import {
    GanttConstraint,
    GanttCurriculumId,
    GanttCurriculumModuleDayMapping,
    GanttWeek,
} from "@/api-shared/types/gantt/models";
import { EventDaySpan } from "@/components/gantt/curriculum-view/gantt-time-utils";

export type GanttConstraintState = {
    constraints: Record<string, GanttConstraint>;
    isLoading: boolean;
};

export type GanttContextType = {
    weeklyView: boolean;
    setWeeklyView: (weeklyView: boolean) => void;
    /** Weekly view only: size/position blocks by the day they occupy instead of filling the whole cell. */
    relativeDaySizing: boolean;
    startDate: null | string;
    timelineWeeks: Array<GanttWeek>;
    linearDays: Array<string>;
    /** O(1) lookup of a dayId's position within linearDays (#159). */
    dayIndexMap: Map<string, number>;
    /** O(1) lookup of a dayId's owning week index within timelineWeeks (#159). */
    weekIndexByDayId: Map<string, number>;
    /**
     * Calendar date of a timeline day as "YYYY-MM-DD", or undefined when the
     * curriculum has no start date. Drives the recurrence window (#468).
     */
    dateOfDayId: (dayId: string) => string | undefined;
    eventMappings: Record<string, string>;
    moduleMappings: Record<string, Array<string>>;
    curriculumMappings: Record<string, GanttCurriculumModuleDayMapping>;
    /** Days each mapped event occupies once multi-day spillover is applied (#105). */
    eventSpans: Record<string, EventDaySpan>;
    /** Per-day scheduled minutes with spillover subtracted/added per day (#105). */
    scheduledMinutesByDay: Record<string, number>;
    violations: Record<string, Array<string>>;
    /** Pixel width of a single day/week column. Widens when a week is zoomed (#90). */
    dayCellWidth: number;
    /** Id of the week currently zoomed to full width, or null (days view only, #90). */
    zoomedWeekId: null | string;
    /** True when a single week is zoomed in day view: header shows allocated/available time and blocks are sized by their required time. */
    singleWeekDayZoom: boolean;
    setZoomedWeekId: (weekId: null | string) => void;
    /**
     * Absolute index of the first visible week within the full timeline. Non-zero
     * only while zoomed, so date labels stay correct when the grid is filtered (#90).
     */
    weekIndexOffset: number;
    /** Per-syllabus expand/collapse state, lifted so all rows can be toggled at once (#91). */
    isSyllabusExpanded: (syllabusId: string) => boolean;
    toggleSyllabus: (syllabusId: string) => void;
    /** Per-module expand/collapse state, lifted so a chip can reveal an event row. */
    isModuleExpanded: (moduleId: string) => boolean;
    toggleModule: (moduleId: string) => void;
    /** True while the first-column search filter is narrowing the row tree (#323). */
    searchActive: boolean;
    /** First-column search predicates: whether a row survives the active filter (#323). */
    isSyllabusVisible: (syllabusId: string) => boolean;
    isModuleVisible: (moduleId: string) => boolean;
    isEventVisible: (eventId: string) => boolean;
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

/** Drag payload carried by a block (module/event chip or cell anchor). */
export type GanttBlockPayload =
    | { moduleId: string; eventId: string; type?: undefined }
    | { type: "event-map"; moduleId: string; eventId: string }
    | {
          type: "event-move";
          moduleId: string;
          eventId: string;
          sourceDayId: string;
      }
    | {
          type: "event-occurrence";
          moduleId: string;
          eventId: string;
          dayId: string;
      }
    | {
          type: "event-skipped-occurrence";
          moduleId: string;
          eventId: string;
          dayId: string;
      }
    | { type: "module-map"; moduleId: string }
    | { type: "module-shift"; moduleId: string; sourceDayId: string };

/** Drop-target payload identifying which module/event a cell resolves to. */
export type GanttCellPayloadData =
    | { targetType: "event"; eventId: string; dayId: string }
    | { targetType: "module"; moduleId: string; dayId: string };

export type GanttBlockProps = {
    id: string;
    payload: GanttBlockPayload;
    title?: string;
    /** Required-time label shown on the block (zoomed single-week day view). */
    timeLabel?: string;
    isOpaque?: boolean;
    spanLength?: number;
    isAbsolute?: boolean;
    elementId?: string;
    violations?: Array<string>;
    /** Percentage (of the anchor cell's own width) offset/width for multi-week spans (#118). */
    blockLeftPercent?: number;
    blockWidthPercent?: number;
    /** Multi-day overflow block: rendered with a spillover gradient (#105). */
    isSpillover?: boolean;
    /**
     * Auto-generated recurrence occurrence (a repeat of a recurring event's
     * start block). Rendered as a faded, non-draggable indicator (#111).
     */
    isRecurrence?: boolean;
    /**
     * A recurrence occurrence the user skipped. Shown as a hollow, struck-out
     * ghost so the gap is visible, and restored on double-click (#469).
     */
    isSkipped?: boolean;
    /** Zoomed single-week day view: module blocks are pinned, not draggable (#640). */
    disableDrag?: boolean;
};

export type GanttCellProps = {
    dayId: string;
    dropId: string;
    payloadData: GanttCellPayloadData;
    hasBlock?: boolean;
    blockId?: string;
    blockPayload?: GanttBlockPayload;
    blockTitle?: string;
    /** Required-time label shown on the block (zoomed single-week day view). */
    blockTimeLabel?: string;
    spanLength?: number;
    isOpaque?: boolean;
    isAbsoluteBlock?: boolean;
    elementId?: string;
    violations?: Array<string>;
    /** Percentage (of the anchor cell's own width) offset/width for multi-week spans (#118). */
    blockLeftPercent?: number;
    blockWidthPercent?: number;
    /** Multi-day overflow block: rendered with a spillover gradient (#105). */
    isSpillover?: boolean;
    /** Auto-generated recurrence occurrence indicator (#111). */
    isRecurrence?: boolean;
    /** Skipped recurrence occurrence — a restorable ghost block (#469). */
    isSkipped?: boolean;
    /** Zoomed single-week day view: module blocks are pinned, not draggable (#640). */
    disableDrag?: boolean;
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
