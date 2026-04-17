import { BaseDocument, baseDocumentFixup, clientGantApiBuilder } from "@/api-client/gantt/base";
import { CreateGanttSyllabusPayload } from "@/api-shared/types/gantt/create-payloads";
import { GanttSyllabus } from "@/api-shared/types/gantt/curriculum";

export type SyllabusDocument = GanttSyllabus & BaseDocument;

const syllabusApi = clientGantApiBuilder<GanttSyllabus, CreateGanttSyllabusPayload>({ apiBaseUrl: '/api/gantt/syllabuses', dateFixup: baseDocumentFixup as any });

const {
    apiList,
    apiGet,
    apiCreate,
    apiUpdate,
    apiDelete,
    apiGetMany,
} = syllabusApi;
export
{
    apiCreate as apiCreateSyllabus, apiDelete as apiDeleteSyllabus, apiGetMany as apiGetManySyllabuses, apiGet as apiGetSyllabus, apiList as apiListSyllabuses, apiUpdate as apiUpdateSyllabus, syllabusApi
};
