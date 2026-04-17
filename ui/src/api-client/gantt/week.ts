import { BaseDocument, baseDocumentFixup, clientGantApiBuilder } from "@/api-client/gantt/base";
import { ApiCurriculumWeek } from "@/api-shared/types/gantt/api-layer";
import { CreateCurriculumWeekPayload } from "@/api-shared/types/gantt/create-payloads";
import { CurriculumWeek } from "@/api-shared/types/gantt/curriculum";

export type CurriculumWeekDocument = CurriculumWeek & BaseDocument;

const weekApi = clientGantApiBuilder<CurriculumWeek, ApiCurriculumWeek, CreateCurriculumWeekPayload>({ apiBaseUrl: '/api/gantt/weeks', dateFixup: baseDocumentFixup as any });

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
