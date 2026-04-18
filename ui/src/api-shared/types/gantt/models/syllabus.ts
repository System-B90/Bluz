import { GanttModuleId } from "@/api-shared/types/gantt/models/module";
import { BaseGantItem } from "@/api-shared/types/gantt/models/shared";

export interface GanttSyllabus extends BaseGantItem
{
    title: string;
    hiveIds: Array<number>;
    modules: Array<GanttModuleId>;
}
export type GanttSyllabusId = GanttSyllabus[ 'id' ];