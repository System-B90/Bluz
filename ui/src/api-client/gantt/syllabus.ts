import { BaseDocument, baseDocumentFixup, clientGantApiBuilder } from "@/api-client/gantt/base";
import { ApiSyllabus } from "@/api-shared/types/gantt/api-layer";
import { CreateSyllabusPayload } from "@/api-shared/types/gantt/create-payloads";
import { Syllabus } from "@/api-shared/types/gantt/curriculum";

export type SyllabusDocument = Syllabus & BaseDocument;

const syllabusApi = clientGantApiBuilder<Syllabus, ApiSyllabus, CreateSyllabusPayload>({ apiBaseUrl: '/api/gant/syllabuses', dateFixup: baseDocumentFixup as any });

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

