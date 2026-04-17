import { curriculumApi } from "@/api-client/gantt/curriculum";
import { dayApi } from "@/api-client/gantt/day";
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
} as const;
export { ganttApi };
export type GanttApi = typeof ganttApi;
