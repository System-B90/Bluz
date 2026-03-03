'use client';
import { buildItemProvider } from "@/components/curriculum/base-provider";
import { Module, SyllabusId } from "@/api-shared/types/curriculum";
import { apiCreateModule, apiDeleteModule, apiGetModule, apiListModules, apiUpdateModule } from "@/api-client/curriculum/module";

const { provider, use } = buildItemProvider<Module, { syllabusId: SyllabusId; }>({
    apiList: (params, options) => apiListModules({ curriculumId: '_', ...params }, options),
    apiGet: (params, moduleId, options) => apiGetModule({ curriculumId: '_', ...params }, moduleId, options),
    apiCreate: (params, newModule, options) => apiCreateModule({ curriculumId: '_', ...params }, newModule, options),
    apiDelete: (params, moduleId, options) => apiDeleteModule({ curriculumId: '_', ...params }, moduleId, options),
    apiUpdate: (params, updates, options) => apiUpdateModule({ curriculumId: '_', ...params }, updates, options),
    itemName: 'מערך',
    providerName: 'ModuleProvider',
    useName: 'useModule',
});

export { provider as ModuleProvider };
export { use as useModule };
