import { BaseDocument, baseDocumentFixup, clientGantApiBuilder } from "@/api-client/gant/base";
import { ApiCurriculumWeek } from "@/api-shared/types/gant/api-layer";
import { CreateCurriculumWeekPayload } from "@/api-shared/types/gant/create-payloads";
import { CurriculumWeek } from "@/api-shared/types/gant/curriculum";

export type CurriculumWeekDocument = CurriculumWeek & BaseDocument;

const weekApi = clientGantApiBuilder<CurriculumWeek, ApiCurriculumWeek, CreateCurriculumWeekPayload>({ apiBaseUrl: '/api/gant/weeks', dateFixup: baseDocumentFixup as any });

const {
    apiList,
    apiGet,
    apiCreate,
    apiUpdate,
    apiDelete,
    apiGetMany,
} = weekApi;

export
{
    apiCreate as apiCreateWeek, apiDelete as apiDeleteWeek, apiGetMany as apiGetManyWeeks, apiGet as apiGetWeek, apiList as apiListWeeks, apiUpdate as apiUpdateWeek, weekApi
};
