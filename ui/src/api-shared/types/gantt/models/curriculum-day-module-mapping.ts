import {
    GanttCurriculumId,
    GanttEventId,
    GanttModuleId,
} from "@/api-shared/types/gantt/models";
import { GanttDayId } from "@/api-shared/types/gantt/models/day";

/**
 * The date mapping of a module.
 * This interface represents an instance of a module or a specific event of a module in a curriculum, set to be at a specific day in a specific week.
 * Each mapping is unique to a event?<->module<->curriculum<->day(<->week)
 * An order field is available in order to maintain a sorted array of mappings which are all temporarily allocated on the same day.
 * This is used when zooming in and out of views.
 */
export type GanttCurriculumEventDayMapping = {
    moduleId: GanttModuleId;
    eventId?: GanttEventId | null;
    dayId: GanttDayId;
    curriculumId: GanttCurriculumId;
    sortOrder: number;
};
