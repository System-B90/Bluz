import { BaseDocument, baseDocumentFixup, clientGantApiBuilder } from "@/api-client/gantt/base";
import { ApiCurriculumDay } from "@/api-shared/types/gantt/api-layer";
import { CreateCurriculumDayPayload } from "@/api-shared/types/gantt/create-payloads";
import { CurriculumDay } from "@/api-shared/types/gantt/curriculum";

export type CurriculumDayDocument = CurriculumDay & BaseDocument;

const dayApi = clientGantApiBuilder<CurriculumDay, ApiCurriculumDay, CreateCurriculumDayPayload>({ apiBaseUrl: '/api/gant/days', dateFixup: baseDocumentFixup as any });

const {
    apiList,
    apiGet,
    apiCreate,
    apiUpdate,
    apiDelete,
    apiGetMany,
} = dayApi;

export
{
    apiCreate as apiCreateDay, apiDelete as apiDeleteDay, apiGet as apiGetDay, apiGetMany as apiGetManyDays, apiList as apiListDays, apiUpdate as apiUpdateDay, dayApi
};

