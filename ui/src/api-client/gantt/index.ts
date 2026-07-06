import { ganttConstraintsApi } from "@/api-client/gantt/constraints";
import { curriculumApi } from "@/api-client/gantt/curriculum";
import { dayApi } from "@/api-client/gantt/day";
import { curriculumModuleDayMappingApi } from "@/api-client/gantt/mappings";
import { moduleApi } from "@/api-client/gantt/module";
import { moduleEventApi } from "@/api-client/gantt/module-event";
import { recurrenceExceptionApi } from "@/api-client/gantt/recurrence-exceptions";
import { apiReorderEvents, apiReorderModules } from "@/api-client/gantt/reorder";
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
    recurrenceExceptions: recurrenceExceptionApi,
    constraints: ganttConstraintsApi,
    reorderModules: apiReorderModules,
    reorderEvents: apiReorderEvents,
} as const;
export { ganttApi };
export type GanttApi = typeof ganttApi;
