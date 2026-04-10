import { BaseDocument, baseDocumentFixup, clientGantApiBuilder } from "@/api-client/gant/base";
import { Syllabus } from "@/api-shared/types/curriculum";

export type SyllabusDocument = Syllabus & BaseDocument;

const { apiList,
    apiGet,
    apiCreate,
    apiUpdate,
    apiDelete,
    apiGetMany,
} = clientGantApiBuilder<Syllabus>({ apiBaseUrl: '/api/gant/syllabus', dateFixup: baseDocumentFixup as any });

export
{
    apiCreate as apiCreateSyllabus, apiDelete as apiDeleteSyllabus, apiGetMany as apiGetManySyllabuses, apiGet as apiGetSyllabus, apiList as apiListSyllabuses, apiUpdate as apiUpdateSyllabus
};

