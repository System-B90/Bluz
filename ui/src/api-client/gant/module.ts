import { BaseDocument, baseDocumentFixup, clientGantApiBuilder } from "@/api-client/gant/base";
import { ApiModule } from "@/api-shared/types/gant/api-layer";
import { CreateModulePayload } from "@/api-shared/types/gant/create-payloads";
import { Module } from "@/api-shared/types/gant/curriculum";

export type ModuleDocument = Module & BaseDocument;

const moduleApi = clientGantApiBuilder<Module, ApiModule, CreateModulePayload>({ apiBaseUrl: '/api/gant/modules', dateFixup: baseDocumentFixup as any });
const {
 apiList,
    apiGet,
    apiCreate,
    apiUpdate,
    apiDelete,
    apiGetMany,
} = moduleApi;
export
{
    apiCreate as apiCreateModule, apiDelete as apiDeleteModule, apiGetMany as apiGetManyModules, apiGet as apiGetModule, apiList as apiListModules, apiUpdate as apiUpdateModule
};

export { moduleApi };
