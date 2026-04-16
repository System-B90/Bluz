import { BaseDocument, baseDocumentFixup, clientGantApiBuilder } from "@/api-client/gant/base";
import { ApiSyllabus } from "@/api-shared/types/gant/api-layer";
import { CreateSyllabusPayload } from "@/api-shared/types/gant/create-payloads";
import { Syllabus } from "@/api-shared/types/gant/curriculum";

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
    apiCreate as apiCreateSyllabus, apiDelete as apiDeleteSyllabus, apiGetMany as apiGetManySyllabuses, apiGet as apiGetSyllabus, apiList as apiListSyllabuses, apiUpdate as apiUpdateSyllabus
};
export { syllabusApi };
