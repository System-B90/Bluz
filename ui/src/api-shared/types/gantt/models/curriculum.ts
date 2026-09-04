import { BaseGantItem } from "@/api-shared/types/gantt/models/shared";
import { GanttSyllabusId } from "@/api-shared/types/gantt/models/syllabus";
import { GanttWeekId } from "@/api-shared/types/gantt/models/week";

export type GanttCurriculum = {
    title: string;
    description: string;
    startDate: null | string;
    syllabuses: Array<GanttSyllabusId>;
    isDraft: boolean;
    /** Archived curriculums are kept as reference, grouped below drafts. */
    isArchived: boolean;
    weeks: Array<GanttWeekId>;
} & BaseGantItem;
export type GanttCurriculumId = GanttCurriculum["id"];

/**
 * Query-string key carrying the active curriculum id on the gantt page. Lives
 * here rather than in `api-server` so the browser can build the same URLs
 * the routes parse.
 */
export const CURRICULUM_QUERY_PARAM = "cid";
