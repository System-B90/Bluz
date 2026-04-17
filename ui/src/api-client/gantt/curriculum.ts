import { BaseDocument, baseDocumentFixup, clientGantApiBuilder } from "@/api-client/gantt/base";
import { ApiCurriculum } from "@/api-shared/types/gantt/api-layer";
import { CreateCurriculumPayload } from "@/api-shared/types/gantt/create-payloads";
import { Curriculum } from "@/api-shared/types/gantt/curriculum";

export type CurriculumDocument = Curriculum & BaseDocument;

const curriculumApi = clientGantApiBuilder<Curriculum, ApiCurriculum, CreateCurriculumPayload>({ apiBaseUrl: '/api/gantt/curriculums', dateFixup: baseDocumentFixup as any });
const {
    apiList,
    apiGet,
    apiCreate,
    apiUpdate,
    apiDelete,
    apiGetMany,
} = curriculumApi;
export
{
    apiCreate as apiCreateCurriculum, apiDelete as apiDeleteCurriculum, apiGet as apiGetCurriculum, apiGetMany as apiGetManyCurriculums, apiList as apiListCurriculums, apiUpdate as apiUpdateCurriculum, curriculumApi
};
