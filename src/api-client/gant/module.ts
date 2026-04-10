import { BaseDocument, baseDocumentFixup, clientGantApiBuilder } from "@/api-client/gant/base";
import { Module } from "@/api-shared/types/curriculum";

export type ModuleDocument = Module & BaseDocument;

const { apiList,
    apiGet,
    apiCreate,
    apiUpdate,
    apiDelete,
    apiGetMany,
} = clientGantApiBuilder<Module>({ apiBaseUrl: '/api/gant/module', dateFixup: baseDocumentFixup as any });

export
{
    apiCreate as apiCreateModule, apiDelete as apiDeleteModule, apiGetMany as apiGetManyModules, apiGet as apiGetModule, apiList as apiListModules, apiUpdate as apiUpdateModule
};

