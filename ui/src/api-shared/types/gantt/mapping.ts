import { CurriculumId, ModuleId } from "@/api-shared/types/gantt/curriculum";

export interface CurriculumModuleDayMapping
{
    moduleId: ModuleId;
    weekIndex: number;
    dayIndex: number;
    curriculumId: CurriculumId;
    sortOrder: number;
}
