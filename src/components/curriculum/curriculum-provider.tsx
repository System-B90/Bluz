'use client';
import { apiCreateCurriculum, apiDeleteCurriculum, apiGetCurriculum, apiListCurriculums, apiUpdateCurriculum, CurriculumDocument } from "@/api-client/curriculum/curriculum";
import { buildItemProvider } from "@/components/curriculum/base-provider";

const { provider, use } = buildItemProvider<CurriculumDocument>({
    apiList: async (_params, options) => apiListCurriculums(options),
    apiGet: (_params, id, options) => apiGetCurriculum(id, options),
    apiCreate: (_params, data, options) => apiCreateCurriculum(data, options),
    apiDelete: (_params, id, options) => apiDeleteCurriculum(id, options),
    apiUpdate: (_params, updates, options) => apiUpdateCurriculum(updates, options),

    itemName: 'גאנט',
    providerName: 'CurriculumProvider',
    useName: 'useCurriculum',
});

export { provider as CurriculumProvider };
export { use as useCurriculum };
