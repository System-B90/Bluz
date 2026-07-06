import {
    GanttCurriculumId,
    GanttDayId,
    GanttEventId,
} from "@/api-shared/types/gantt/models";

/**
 * Marks a single occurrence day of a recurring event as excepted within a
 * curriculum: the event no longer echoes onto that day, either because the
 * occurrence was deleted outright or materialized into its own standalone
 * event.
 */
export type GanttEventRecurrenceException = {
    id: string;
    curriculumId: GanttCurriculumId;
    eventId: GanttEventId;
    dayId: GanttDayId;
};
