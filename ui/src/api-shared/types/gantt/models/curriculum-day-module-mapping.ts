import { GanttCurriculumId } from "@/api-shared/types/gantt/models/curriculum";
import { GanttDayId } from "@/api-shared/types/gantt/models/day";
import { GanttModuleId } from "@/api-shared/types/gantt/models/module";

/**
 * The date mapping of a module.
 * This interface represents an instance of a module in a curriculum, set to be at a specific day in a specific week.
 * Each mapping is unique to a module<->curriculum<->day(<->week)
 * An order field is available in order to maintain a sorted array of mappings which are all temporarily allocated on the same day.
 * This is used when zooming in and out of views.
 */
export interface GanttCurriculumModuleDayMapping {
  moduleId: GanttModuleId;
  dayId: GanttDayId;
  curriculumId: GanttCurriculumId;
  sortOrder: number;
}
