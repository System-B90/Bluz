import { BaseDocument, baseDocumentFixup, clientGantApiBuilder } from "@/api-client/gant/base";
import { Curriculum } from "@/api-shared/types/gant/curriculum";

export type CurriculumDocument = Curriculum & BaseDocument;


const { apiList,
    apiGet,
    apiCreate,
    apiUpdate,
    apiDelete,
    apiGetMany,
} = clientGantApiBuilder<Curriculum>({ apiBaseUrl: '/api/gant/curriculum', dateFixup: baseDocumentFixup as any });

export
{
    apiCreate as apiCreateCurriculum, apiDelete as apiDeleteCurriculum, apiGet as apiGetCurriculum, apiGetMany as apiGetManyCurriculums, apiList as apiListCurriculums, apiUpdate as apiUpdateCurriculum
};

