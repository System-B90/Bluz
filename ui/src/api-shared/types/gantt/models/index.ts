export { getAllowedDayIndices } from "@/api-shared/types/gantt/models/constraint";
export type { GanttConstraint } from "@/api-shared/types/gantt/models/constraint";
export type {
    GanttCurriculum,
    GanttCurriculumId,
} from "@/api-shared/types/gantt/models/curriculum";
export type { GanttCurriculumEventDayMapping as GanttCurriculumModuleDayMapping } from "@/api-shared/types/gantt/models/curriculum-day-module-mapping";

export {
    DAY_NAME_DISPLAY,
    GanttDayIndex,
    getDayNameDisplay,
    DAYS_OF_WEEK,
    HEBREW_DAYS_SHORT,
    HEBREW_DAYS_SINGLE_LETTER,
} from "@/api-shared/types/gantt/models/day";
export type { GanttDay, GanttDayId, DayOfWeekConfig } from "@/api-shared/types/gantt/models/day";

export {
    defaultSplitAcrossBreaks,
    EventRecurrence,
    ModuleEventType,
    RoomRequirement,
} from "@/api-shared/types/gantt/models/event";
export type {
    GanttEvent,
    GanttEventId,
} from "@/api-shared/types/gantt/models/event";
export type {
    GanttModule,
    GanttModuleId,
} from "@/api-shared/types/gantt/models/module";
export type { GanttEventRecurrenceException } from "@/api-shared/types/gantt/models/recurrence-exception";
export type { BaseGantItem } from "@/api-shared/types/gantt/models/shared";
export type {
    GanttSyllabus,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models/syllabus";
export type {
    GanttWeek,
    GanttWeekId,
} from "@/api-shared/types/gantt/models/week";
