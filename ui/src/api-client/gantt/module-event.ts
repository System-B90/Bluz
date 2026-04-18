import { BaseDocument, baseDocumentFixup, clientGantApiBuilder } from "@/api-client/gantt/base";
import { CreateGanttEventPayload } from "@/api-shared/types/gantt/create-payloads";
import { GanttEvent } from "@/api-shared/types/gantt/models/curriculum";

export type ModuleEventDocument = GanttEvent & BaseDocument;

const moduleEventApi = clientGantApiBuilder<GanttEvent, CreateGanttEventPayload>({ apiBaseUrl: '/api/gantt/events', dateFixup: baseDocumentFixup as any });
const {
    apiList,
    apiGet,
    apiCreate,
    apiUpdate,
    apiDelete,
    apiGetMany,
} = moduleEventApi;
export
{
    apiCreate as apiCreateModuleEvent, apiDelete as apiDeleteModuleEvent, apiGetMany as apiGetManyModuleEvents, apiGet as apiGetModuleEvent, apiList as apiListModuleEvents, apiUpdate as apiUpdateModuleEvent, moduleEventApi
};

