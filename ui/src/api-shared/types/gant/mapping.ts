import { CurriculumId, ModuleId } from "@/api-shared/types/gant/curriculum";

export interface CurriculumModuleDayMapping
{
    moduleId: ModuleId;
    weekIndex: number;
    dayIndex: number;
    curriculumId: CurriculumId;
    sortOrder: number;
}
