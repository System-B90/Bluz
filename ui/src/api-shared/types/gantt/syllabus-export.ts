import { ApiSyllabus } from "@/api-shared/types/gantt/api-layer";

/** Marks a file as one syllabus, not a whole curriculum (#757). */
export const SYLLABUS_EXPORT_KIND = "bluz-syllabus";

/** What `GET /api/gantt/syllabuses/{id}/export` returns and the import accepts. */
export type SyllabusExportDocument = {
    version: "1.0";
    kind: typeof SYLLABUS_EXPORT_KIND;
    /** Curriculum whose allocated durations travel with the file. */
    sourceCurriculumId?: string;
    syllabus: ApiSyllabus;
    constraints: Array<unknown>;
};
