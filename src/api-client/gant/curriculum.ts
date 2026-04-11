import { BaseDocument, baseDocumentFixup, clientGantApiBuilder } from "@/api-client/gant/base";
import { CreateCurriculumPayload } from "@/api-shared/types/gant/create-payloads";
import { Curriculum } from "@/api-shared/types/gant/curriculum";

export type CurriculumDocument = Curriculum & BaseDocument;

const curriculumApi = clientGantApiBuilder<Curriculum, CreateCurriculumPayload>({ apiBaseUrl: '/api/gant/curriculums', dateFixup: baseDocumentFixup as any });
const { apiList,
    apiGet,
    apiCreate,
    apiUpdate,
    apiDelete,
    apiGetMany,
} = curriculumApi;
export
{
    apiCreate as apiCreateCurriculum, apiDelete as apiDeleteCurriculum, apiGet as apiGetCurriculum, apiGetMany as apiGetManyCurriculums, apiList as apiListCurriculums, apiUpdate as apiUpdateCurriculum
};
export { curriculumApi };
