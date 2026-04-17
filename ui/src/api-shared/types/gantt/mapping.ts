import { GanttCurriculumId, GanttModuleId } from "@/api-shared/types/gantt/curriculum";

// TODO: WTF is this?
export interface GanttCurriculumModuleDayMapping
{
    moduleId: GanttModuleId;
    weekIndex: number;
    dayIndex: number;
    curriculumId: GanttCurriculumId;
    sortOrder: number;
}
