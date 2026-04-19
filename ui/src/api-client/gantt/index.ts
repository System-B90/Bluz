import { ganttConstraintsApi } from "@/api-client/gantt/constraints";
import { curriculumApi } from "@/api-client/gantt/curriculum";
import { dayApi } from "@/api-client/gantt/day";
import { curriculumModuleDayMappingApi } from "@/api-client/gantt/mappings";
import { moduleApi } from "@/api-client/gantt/module";
import { moduleEventApi } from "@/api-client/gantt/module-event";
import { syllabusApi } from "@/api-client/gantt/syllabus";
import { weekApi } from "@/api-client/gantt/week";

const ganttApi = {
    curriculum: curriculumApi,
    day: dayApi,
    module: moduleApi,
    event: moduleEventApi,
    syllabus: syllabusApi,
    week: weekApi,
    mappings: curriculumModuleDayMappingApi,
    constraints: ganttConstraintsApi,
} as const;
export { ganttApi };
export type GanttApi = typeof ganttApi;
