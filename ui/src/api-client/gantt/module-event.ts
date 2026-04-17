import { BaseDocument, baseDocumentFixup, clientGantApiBuilder } from "@/api-client/gantt/base";
import { ApiModuleEvent } from "@/api-shared/types/gantt/api-layer";
import { CreateModuleEventPayload } from "@/api-shared/types/gantt/create-payloads";
import { ModuleEvent } from "@/api-shared/types/gantt/curriculum";

export type ModuleEventDocument = ModuleEvent & BaseDocument;

const moduleEventApi = clientGantApiBuilder<ModuleEvent, ApiModuleEvent, CreateModuleEventPayload>({ apiBaseUrl: '/api/gantt/events', dateFixup: baseDocumentFixup as any });
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
