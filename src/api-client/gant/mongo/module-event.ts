import { BaseDocument, baseDocumentFixup, clientGantApiBuilder } from "@/api-client/gant/base";
import { ModuleEvent } from "@/api-shared/types/gant/curriculum";

export type ModuleEventDocument = ModuleEvent & BaseDocument;

const { apiList,
    apiGet,
    apiCreate,
    apiUpdate,
    apiDelete,
    apiGetMany,
} = clientGantApiBuilder<ModuleEvent>({ apiBaseUrl: '/api/gant/event', dateFixup: baseDocumentFixup as any });

export
{
    apiCreate as apiCreateModuleEvent, apiDelete as apiDeleteModuleEvent, apiGetMany as apiGetManyModuleEvents, apiGet as apiGetModuleEvent, apiList as apiListModuleEvents, apiUpdate as apiUpdateModuleEvent
};

