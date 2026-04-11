import { BaseDocument, clientGantApiBuilder, baseDocumentFixup } from "@/api-client/gant/base";
import { ApiModuleEvent } from "@/api-shared/types/gant/api-layer";
import { CreateModuleEventPayload } from "@/api-shared/types/gant/create-payloads";
import { ModuleEvent } from "@/api-shared/types/gant/curriculum";

export type ModuleEventDocument = ModuleEvent & BaseDocument;

const moduleEventApi = clientGantApiBuilder<ModuleEvent, ApiModuleEvent, CreateModuleEventPayload>({ apiBaseUrl: '/api/gant/events', dateFixup: baseDocumentFixup as any });
const { apiList,
    apiGet,
    apiCreate,
    apiUpdate,
    apiDelete,
    apiGetMany,
} = moduleEventApi;
export
{
    apiCreate as apiCreateModuleEvent, apiDelete as apiDeleteModuleEvent, apiGetMany as apiGetManyModuleEvents, apiGet as apiGetModuleEvent, apiList as apiListModuleEvents, apiUpdate as apiUpdateModuleEvent
};
export { moduleEventApi };
